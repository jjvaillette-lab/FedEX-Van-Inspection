import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { uploadVanFile } from "@/lib/storage";
import type { MaintenanceRecord } from "@/lib/types";

export const runtime = "nodejs";

const MIGRATION_MSG =
  "Database update required: run supabase/migration-v4.sql in the Supabase SQL editor.";

interface Row {
  id: string;
  created_at: string;
  van_id: string;
  date: string;
  mileage: number | null;
  category: string;
  description: string;
  cost: number | string;
  receipt_url: string | null;
  created_by: string | null;
}

const rowToRecord = (r: Row): MaintenanceRecord => ({
  id: r.id,
  createdAt: r.created_at,
  vanId: r.van_id,
  date: r.date,
  mileage: r.mileage,
  category: r.category,
  description: r.description,
  cost: Number(r.cost) || 0,
  receiptUrl: r.receipt_url,
  createdBy: r.created_by,
});

export async function GET(request: Request) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ entries: [], persisted: false });
  const vanId = new URL(request.url).searchParams.get("vanId");
  let query = supabase.from("maintenance").select("*").order("date", { ascending: false });
  if (vanId) query = query.eq("van_id", vanId);
  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ entries: [], persisted: false, error: MIGRATION_MSG });
  }
  return NextResponse.json({ entries: (data as Row[]).map(rowToRecord), persisted: true });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Partial<MaintenanceRecord> & {
    receiptDataUrl?: string;
  };
  if (!body.vanId?.trim() || !body.date || !body.description?.trim()) {
    return NextResponse.json(
      { error: "Van, date, and a description are required." },
      { status: 400 }
    );
  }
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Database not configured." }, { status: 503 });

  let receiptUrl: string | null = null;
  if (body.receiptDataUrl) {
    try {
      receiptUrl = await uploadVanFile(
        body.vanId.trim(),
        `maintenance-${Date.now()}`,
        body.receiptDataUrl
      );
    } catch {
      /* receipt is optional — the entry still saves */
    }
  }

  const { data, error } = await supabase
    .from("maintenance")
    .insert({
      van_id: body.vanId.trim(),
      date: body.date,
      mileage: body.mileage ?? null,
      category: body.category?.trim() || "Repair",
      description: body.description.trim(),
      cost: Number(body.cost) || 0,
      receipt_url: receiptUrl,
      created_by: body.createdBy ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: /relation|schema cache/i.test(error.message) ? MIGRATION_MSG : `Save failed: ${error.message}` },
      { status: 500 }
    );
  }
  return NextResponse.json({ entry: rowToRecord(data as Row) }, { status: 201 });
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  const { error } = await supabase.from("maintenance").delete().eq("id", id);
  if (error) return NextResponse.json({ error: `Delete failed: ${error.message}` }, { status: 500 });
  return NextResponse.json({ ok: true });
}
