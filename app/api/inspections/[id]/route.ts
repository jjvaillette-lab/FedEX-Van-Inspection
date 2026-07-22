import { NextResponse } from "next/server";
import { listInspections, updateInspection, uploadVanFile } from "@/lib/storage";
import type { InspectionComment, Resolution } from "@/lib/types";

export const runtime = "nodejs";

type PatchBody =
  | {
      action: "resolve";
      note?: string;
      resolvedBy?: string;
      /** Optional receipt file as a data URL; stored in the van's folder. */
      receiptDataUrl?: string;
    }
  | {
      action: "comment";
      text?: string;
      by?: string;
      role?: "owner" | "manager";
      disagreement?: boolean;
    };

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => null)) as PatchBody | null;
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const all = await listInspections();
  const inspection = all.find((i) => i.id === id);
  if (!inspection) return NextResponse.json({ error: "Inspection not found" }, { status: 404 });

  try {
    if (body.action === "resolve") {
      if (!body.note?.trim() || !body.resolvedBy?.trim()) {
        return NextResponse.json(
          { error: "A resolution note and your name are required." },
          { status: 400 }
        );
      }
      const resolution: Resolution = {
        note: body.note.trim(),
        resolvedBy: body.resolvedBy.trim(),
        resolvedAt: new Date().toISOString(),
      };
      if (body.receiptDataUrl) {
        resolution.receiptUrl = await uploadVanFile(
          inspection.vanId,
          `receipt-${id.slice(0, 8)}-${Date.now()}`,
          body.receiptDataUrl
        );
      }
      await updateInspection(id, { resolution });
      return NextResponse.json({ ok: true, resolution });
    }

    if (body.action === "comment") {
      if (!body.text?.trim() || !body.by?.trim()) {
        return NextResponse.json({ error: "Comment text is required." }, { status: 400 });
      }
      // Driver-submitted answers/photos are never modified — office comments
      // are appended alongside them, preserving both records.
      const comment: InspectionComment = {
        text: body.text.trim(),
        by: body.by.trim(),
        role: body.role === "owner" ? "owner" : "manager",
        at: new Date().toISOString(),
        disagreement: !!body.disagreement,
      };
      const comments = [...(inspection.comments ?? []), comment];
      await updateInspection(id, { comments });
      return NextResponse.json({ ok: true, comments });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Update failed" },
      { status: 500 }
    );
  }
}
