/**
 * Browser-side receipt upload: file goes straight to cloud storage via a
 * one-time signed URL, so size limits on our own API never bite. Returns
 * the file's public URL, or null when direct upload isn't available
 * (caller may fall back to inlining small files).
 */
/** Receipt size cap — stated up front and enforced everywhere. */
export const MAX_RECEIPT_MB = 10;

/** Friendly validation at file-pick time; null when the file is fine. */
export function validateReceiptFile(file: File): string | null {
  if (file.size > MAX_RECEIPT_MB * 1024 * 1024) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return `Receipts can be up to ${MAX_RECEIPT_MB} MB — this file is ${mb} MB. Try a smaller scan or snap a photo of the receipt instead.`;
  }
  return null;
}

export async function uploadReceiptFile(file: File, vanId: string): Promise<string | null> {
  try {
    if (validateReceiptFile(file)) return null;
    const res = await fetch("/api/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vanId, filename: file.name, size: file.size }),
    });
    if (!res.ok) return null;
    const { signedUrl, publicUrl } = (await res.json()) as {
      signedUrl?: string;
      publicUrl?: string;
    };
    if (!signedUrl || !publicUrl) return null;
    const put = await fetch(signedUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
    return put.ok ? publicUrl : null;
  } catch {
    return null;
  }
}

/** Parse a fetch response that should be JSON, with a friendly size error. */
export async function parseJsonResponse(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    if (res.status === 413) {
      throw new Error("That file is too large to attach — try a smaller file or a photo of the receipt.");
    }
    throw new Error(`Save failed (${res.status}). Try again.`);
  }
}
