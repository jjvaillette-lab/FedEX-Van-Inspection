"use client";

import { useState } from "react";
import Link from "next/link";

export default function VansPage() {
  const [vanId, setVanId] = useState("");
  const [label, setLabel] = useState("");
  const [qr, setQr] = useState<{ id: string; label: string; dataUrl: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    const id = vanId.trim().toUpperCase();
    if (!id) return;
    setError(null);
    try {
      const QRCode = (await import("qrcode")).default;
      const dataUrl = await QRCode.toDataURL(id, { width: 600, margin: 2 });
      setQr({ id, label: label.trim(), dataUrl });
    } catch {
      setError("Could not generate QR code.");
    }
  }

  function printQr() {
    if (!qr) return;
    const w = window.open("", "_blank", "width=600,height=800");
    if (!w) return;
    w.document.write(`
      <html><head><title>${qr.id}</title>
      <style>
        body{font-family:system-ui,sans-serif;text-align:center;padding:40px;}
        img{width:340px;height:340px;}
        h1{font-size:34px;margin:16px 0 4px;}
        p{font-size:18px;color:#444;margin:0;}
        .note{margin-top:24px;font-size:13px;color:#888;}
      </style></head>
      <body>
        <img src="${qr.dataUrl}" alt="${qr.id}"/>
        <h1>${qr.id}</h1>
        <p>${qr.label || ""}</p>
        <p class="note">Parali Van Check — mount inside the driver door</p>
        <script>window.onload=function(){window.print();}</script>
      </body></html>`);
    w.document.close();
  }

  return (
    <main className="mx-auto max-w-md px-5 pb-16">
      <header className="flex items-center gap-3 py-5">
        <Link href="/portal/fleet" className="text-slate-400">
          ‹ Back
        </Link>
        <h1 className="text-lg font-bold">Van QR Generator</h1>
      </header>

      <p className="mb-5 text-sm text-slate-500">
        Create a QR code for each van once. Print it and mount it inside the van (driver door works
        well). Drivers scan it during the safety check.
      </p>

      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">Van ID</label>
          <input
            value={vanId}
            onChange={(e) => setVanId(e.target.value)}
            placeholder="VAN-014"
            className="w-full rounded-lg border border-slate-300 px-4 py-3 text-lg uppercase outline-none focus:border-sky-500"
          />
          <p className="mt-1 text-xs text-slate-400">This value is encoded in the QR code.</p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">
            Description <span className="text-slate-400">(optional)</span>
          </label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="White Sprinter · Plate ABC-1234"
            className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
          />
        </div>
        <button
          onClick={generate}
          disabled={!vanId.trim()}
          className="w-full rounded-lg bg-sky-600 py-3 font-semibold text-white disabled:opacity-40"
        >
          Generate QR Code
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      {qr && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr.dataUrl} alt={qr.id} className="mx-auto h-56 w-56" />
          <p className="mt-3 text-xl font-bold">{qr.id}</p>
          {qr.label && <p className="text-sm text-slate-500">{qr.label}</p>}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <a
              href={qr.dataUrl}
              download={`${qr.id}.png`}
              className="rounded-lg border border-slate-300 bg-white py-2.5 text-sm font-medium text-slate-700"
            >
              Download
            </a>
            <button
              onClick={printQr}
              className="rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white"
            >
              Print
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
