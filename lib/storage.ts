import { promises as fs } from "fs";
import path from "path";
import type { Inspection, InspectionPhoto } from "./types";
import { getSupabase, PHOTO_BUCKET } from "./supabase";

/**
 * Storage abstraction for inspections.
 *
 * If Supabase is configured (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in
 * .env.local) it saves to the cloud: photos go to a Storage bucket and the row
 * goes to the `inspections` table. Otherwise it falls back to a local JSON file
 * so the app keeps working with zero setup. The rest of the app only calls
 * saveInspection() / listInspections(), so nothing else changes either way.
 */

export async function saveInspection(inspection: Inspection): Promise<void> {
  const supabase = getSupabase();
  if (supabase) {
    await saveToSupabase(inspection);
  } else {
    await saveToLocalFile(inspection);
  }
}

export async function listInspections(): Promise<Inspection[]> {
  const supabase = getSupabase();
  return supabase ? listFromSupabase() : listFromLocalFile();
}

/* ------------------------------------------------------------------ */
/* Supabase backend                                                    */
/* ------------------------------------------------------------------ */

async function saveToSupabase(inspection: Inspection): Promise<void> {
  const supabase = getSupabase()!;

  // Upload each photo to Storage and swap the inline base64 for a public URL.
  const uploadedPhotos: InspectionPhoto[] = [];
  for (const photo of inspection.photos) {
    const match = /^data:(.+?);base64,(.*)$/s.exec(photo.url);
    if (!match) {
      // Already a URL (or empty) — keep as-is.
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
    uploadedPhotos.push({ slot: photo.slot, url: data.publicUrl });
  }

  const { error } = await supabase.from("inspections").insert({
    id: inspection.id,
    created_at: inspection.createdAt,
    driver: inspection.driver,
    van_id: inspection.vanId,
    answers: inspection.answers,
    photos: uploadedPhotos,
    has_issues: inspection.hasIssues,
    status: inspection.status,
  });
  if (error) throw new Error(`Insert failed: ${error.message}`);
}

interface InspectionRow {
  id: string;
  created_at: string;
  driver: Inspection["driver"];
  van_id: string;
  answers: Inspection["answers"];
  photos: Inspection["photos"];
  has_issues: boolean;
  status: Inspection["status"];
}

async function listFromSupabase(): Promise<Inspection[]> {
  const supabase = getSupabase()!;
  const { data, error } = await supabase
    .from("inspections")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Query failed: ${error.message}`);

  return (data as InspectionRow[]).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    driver: row.driver,
    vanId: row.van_id,
    answers: row.answers,
    photos: row.photos ?? [],
    hasIssues: row.has_issues,
    status: row.status,
  }));
}

/* ------------------------------------------------------------------ */
/* Local-file backend (fallback until Supabase keys are set)           */
/* ------------------------------------------------------------------ */

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "inspections.json");

async function listFromLocalFile(): Promise<Inspection[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    return JSON.parse(raw) as Inspection[];
  } catch {
    return [];
  }
}

async function saveToLocalFile(inspection: Inspection): Promise<void> {
  const all = await listFromLocalFile();
  all.unshift(inspection); // newest first
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(all, null, 2), "utf8");
}
