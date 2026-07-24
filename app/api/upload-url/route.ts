import { NextResponse } from "next/server";
import { getSupabase, PHOTO_BUCKET } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * Direct-to-storage uploads for receipts. The browser asks for a one-time
 * signed URL, then sends the file straight to Supabase Storage — so big PDFs
 * never squeeze through our API's request-size limit. Team-session only
 * (proxy.ts gates this path).
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    vanId?: string;
    filename?: string;
    size?: number;
  };
  const MAX_MB = 10;
  if (typeof body.size === "number" && body.size > MAX_MB * 1024 * 1024) {
    return NextResponse.json(
      { error: `Receipts can be up to ${MAX_MB} MB. Try a smaller scan or a photo of the receipt.` },
      { status: 413 }
    );
  }
  const vanId = body.vanId?.trim() || "general";
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Storage not configured." }, { status: 503 });

  const safeName = (body.filename ?? "receipt")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(-60);
  const path = `receipts/${vanId}/${Date.now()}-${safeName}`;

  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    return NextResponse.json({ error: `Upload setup failed: ${error?.message}` }, { status: 500 });
  }
  const { data: pub } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  return NextResponse.json({ signedUrl: data.signedUrl, publicUrl: pub.publicUrl });
}
