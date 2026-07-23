import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { uploadVanFile } from "@/lib/storage";
import { companyFromRequest, missingCompanyColumn } from "@/lib/company";
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
  const companyId = await companyFromRequest(request);
  const build = (scoped: boolean) => {
    let query = supabase.from("maintenance").select("*").order("date", { ascending: false });
    if (scoped) query = query.eq("company_id", companyId);
    if (vanId) query = query.eq("van_id", vanId);
    return query;
  };
  let { data, error } = await build(true);
  if (error && missingCompanyColumn(error.message)) {
    ({ data, error } = await build(false));
  }
  if (error) {
    return NextResponse.json({ entries: [], persisted: false, error: MIGRATION_MSG });
  }
  return NextResponse.json({ entries: (data as Row[]).map(rowToRecord), persisted: true });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Partial<MaintenanceRecord> & {
    receiptDataUrl?: string;
  };
  // Minimum required entry: the van, the date performed, and the dollar amount.
  if (!body.vanId?.trim() || !body.date || body.cost == null || body.cost === ("" as unknown)) {
    return NextResponse.json(
      { error: "Van, date, and a dollar amount are required." },
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

  const companyId = await companyFromRequest(request);
  const row = {
    van_id: body.vanId.trim(),
    date: body.date,
    mileage: body.mileage ?? null,
    category: body.category?.trim() || "Repair",
    description: body.description?.trim() || "—",
    cost: Number(body.cost) || 0,
    receipt_url: receiptUrl,
    created_by: body.createdBy ?? null,
  };
  let { data, error } = await supabase
    .from("maintenance")
    .insert({ ...row, company_id: companyId })
    .select()
    .single();
  if (error && missingCompanyColumn(error.message)) {
    ({ data, error } = await supabase.from("maintenance").insert(row).select().single());
  }

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
  const companyId = await companyFromRequest(request);
  let { error } = await supabase
    .from("maintenance")
    .delete()
    .eq("id", id)
    .eq("company_id", companyId);
  if (error && missingCompanyColumn(error.message)) {
    ({ error } = await supabase.from("maintenance").delete().eq("id", id));
  }
  if (error) return NextResponse.json({ error: `Delete failed: ${error.message}` }, { status: 500 });
  return NextResponse.json({ ok: true });
}
