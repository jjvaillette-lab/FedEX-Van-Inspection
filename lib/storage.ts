import { promises as fs } from "fs";
import path from "path";
import type { Inspection, InspectionPhoto } from "./types";
import { getSupabase, PHOTO_BUCKET } from "./supabase";

/**
 * Storage abstraction for inspections.
 *
 * Supabase when configured (photos → Storage bucket, rows → `inspections`),
 * local JSON file otherwise. If the v2 migration hasn't been run yet, inserts
 * retry with the legacy column set so inspections are never lost; the new
 * fields simply start persisting once the migration is applied.
 */

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export async function saveInspection(inspection: Inspection): Promise<void> {
  const supabase = getSupabase();
  if (supabase) await saveToSupabase(inspection);
  else await saveToLocalFile(inspection);
}

export async function listInspections(vanId?: string): Promise<Inspection[]> {
  const supabase = getSupabase();
  const all = supabase ? await listFromSupabase() : await listFromLocalFile();
  return vanId ? all.filter((i) => i.vanId === vanId) : all;
}

/** Apply a partial update (resolution, comments, status). */
export async function updateInspection(
  id: string,
  patch: Partial<Pick<Inspection, "resolution" | "comments" | "status" | "hasIssues">>
): Promise<void> {
  const supabase = getSupabase();
  if (supabase) {
    const row: Record<string, unknown> = {};
    if (patch.resolution !== undefined) row.resolution = patch.resolution;
    if (patch.comments !== undefined) row.comments = patch.comments;
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.hasIssues !== undefined) row.has_issues = patch.hasIssues;
    const { error } = await supabase.from("inspections").update(row).eq("id", id);
    if (error) {
      throw new Error(
        isMissingColumn(error.message)
          ? "Database update required: run supabase/migration-v2.sql in the Supabase SQL editor."
          : `Update failed: ${error.message}`
      );
    }
    return;
  }
  const all = await listFromLocalFile();
  const idx = all.findIndex((i) => i.id === id);
  if (idx < 0) throw new Error("Inspection not found");
  all[idx] = { ...all[idx], ...patch };
  await writeLocalFile(all);
}

/** Upload a receipt/file for a van to Storage; returns its public URL. */
export async function uploadVanFile(
  vanId: string,
  fileName: string,
  dataUrl: string
): Promise<string> {
  const supabase = getSupabase();
  const match = /^data:(.+?);base64,([\s\S]*)$/.exec(dataUrl);
  if (!match) throw new Error("Invalid file data");
  if (!supabase) return dataUrl; // local fallback keeps the data URL inline

  const contentType = match[1];
  const buffer = Buffer.from(match[2], "base64");
  const ext = contentType.split("/")[1]?.split("+")[0] || "bin";
  const objectPath = `receipts/${vanId}/${fileName}.${ext}`;
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(objectPath, buffer, { contentType, upsert: true });
  if (error) throw new Error(`File upload failed: ${error.message}`);
  const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(objectPath);
  return data.publicUrl;
}

/* ------------------------------------------------------------------ */
/* Supabase backend                                                    */
/* ------------------------------------------------------------------ */

function isMissingColumn(message: string): boolean {
  return /column|schema cache/i.test(message);
}

async function saveToSupabase(inspection: Inspection): Promise<void> {
  const supabase = getSupabase()!;

  // Upload each photo, swapping inline base64 for a Storage URL.
  const uploadedPhotos: InspectionPhoto[] = [];
  for (const photo of inspection.photos) {
    const match = /^data:(.+?);base64,([\s\S]*)$/.exec(photo.url);
    if (!match) {
      uploadedPhotos.push(photo);
      continue;
    }
    const contentType = match[1];
    const buffer = Buffer.from(match[2], "base64");
    const ext = contentType.split("/")[1]?.split("+")[0] || "jpg";
    const objectPath = `${inspection.id}/${photo.slot}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(objectPath, buffer, { contentType, upsert: true });
    if (uploadError) throw new Error(`Photo upload failed: ${uploadError.message}`);
    const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(objectPath);
    uploadedPhotos.push({ ...photo, url: data.publicUrl });
  }

  const legacyRow = {
    id: inspection.id,
    created_at: inspection.createdAt,
    driver: inspection.driver,
    van_id: inspection.vanId,
    answers: inspection.answers,
    photos: uploadedPhotos,
    has_issues: inspection.hasIssues,
    status: inspection.status,
  };
  const fullRow = {
    ...legacyRow,
    trip_type: inspection.tripType,
    cycle: inspection.cycle,
    resolution: inspection.resolution ?? null,
    comments: inspection.comments ?? [],
  };

  const { error } = await supabase.from("inspections").insert(fullRow);
  if (!error) return;

  // Pre-migration database: keep the record, minus the new columns.
  if (isMissingColumn(error.message)) {
    const { error: legacyError } = await supabase.from("inspections").insert(legacyRow);
    if (legacyError) throw new Error(`Insert failed: ${legacyError.message}`);
    return;
  }
  throw new Error(`Insert failed: ${error.message}`);
}

interface InspectionRow {
  id: string;
  created_at: string;
  driver: Inspection["driver"];
  van_id: string;
  answers: Inspection["answers"];
  photos: Inspection["photos"];
  has_issues: boolean;
  status: string;
  trip_type?: string;
  cycle?: number;
  resolution?: Inspection["resolution"];
  comments?: Inspection["comments"];
}

function mapStatus(s: string): Inspection["status"] {
  if (s === "submitted") return "passed";
  if (s === "reported_to_management") return "flagged";
  if (s === "passed" || s === "flagged" || s === "failed_inspection") return s;
  return "passed";
}

function rowToInspection(row: InspectionRow): Inspection {
  return {
    id: row.id,
    createdAt: row.created_at,
    driver: row.driver,
    vanId: row.van_id,
    tripType: row.trip_type === "post" ? "post" : "pre",
    cycle: row.cycle ?? 1,
    answers: row.answers ?? [],
    photos: row.photos ?? [],
    hasIssues: row.has_issues,
    status: mapStatus(row.status),
    resolution: row.resolution ?? null,
    comments: row.comments ?? [],
  };
}

async function listFromSupabase(): Promise<Inspection[]> {
  const supabase = getSupabase()!;
  const { data, error } = await supabase
    .from("inspections")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Query failed: ${error.message}`);
  return (data as InspectionRow[]).map(rowToInspection);
}

/* ------------------------------------------------------------------ */
/* Local-file backend                                                  */
/* ------------------------------------------------------------------ */

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "inspections.json");

async function listFromLocalFile(): Promise<Inspection[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as (Inspection & { status: string })[];
    return parsed.map((i) => ({
      ...i,
      tripType: i.tripType === "post" ? "post" : "pre",
      cycle: i.cycle ?? 1,
      status: mapStatus(i.status),
      comments: i.comments ?? [],
    }));
  } catch {
    return [];
  }
}

async function writeLocalFile(all: Inspection[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(all, null, 2), "utf8");
}

async function saveToLocalFile(inspection: Inspection): Promise<void> {
  const all = await listFromLocalFile();
  all.unshift(inspection);
  await writeLocalFile(all);
}
