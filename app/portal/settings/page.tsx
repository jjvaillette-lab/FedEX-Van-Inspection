"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/app/components/portal/AuthProvider";
import BrandLogo from "@/app/components/portal/BrandLogo";
import {
  DEMO_USERS,
  PERMISSIONS,
  SENSITIVE_PERMISSIONS,
  type PermissionKey,
} from "@/lib/tenant";

/** Owner panel: the activation link/QR that sets up each driver phone. */
function DriverDevicesSection({ brand }: { brand: string }) {
  const [info, setInfo] = useState<{ url: string; key: string } | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/driver-key")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Unavailable");
        setInfo(data);
        const QRCode = (await import("qrcode")).default;
        setQr(await QRCode.toDataURL(data.url, { width: 400, margin: 2 }));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Unavailable"));
  }, []);

  const copy = async () => {
    if (!info) return;
    try {
      await navigator.clipboard.writeText(info.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-bold text-slate-900">Driver devices</h2>
      <p className="mt-1 text-sm text-slate-500">
        Set up each driver phone once: open this link on the device (or scan the QR code with its
        camera), tap Share → &quot;Add to Home Screen&quot;, then open the new{" "}
        <strong>Van Check</strong> icon — if it asks for the activation code on first launch, enter
        it once. Driver devices can only run inspections — they can never reach this portal.
      </p>

      {error ? (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </p>
      ) : !info ? (
        <p className="mt-4 text-sm text-slate-400">Loading…</p>
      ) : (
        <div className="mt-5 flex flex-col items-start gap-5 sm:flex-row">
          {qr && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="Driver activation QR code" className="h-40 w-40 rounded-lg border border-slate-200" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Activation link
            </p>
            <p className="mt-1 break-all rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700">
              {info.url}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={copy}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
                style={{ background: brand }}
              >
                {copied ? "Copied ✓" : "Copy link"}
              </button>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Activation code (to type manually on a device):{" "}
              <span className="font-mono text-slate-600">{info.key}</span>. Each activation lasts a
              year. To revoke access later, change DRIVER_KEY — existing devices keep working until
              their activation expires, new activations need the new code.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

const COLOR_PRESETS = ["#0E7C5A", "#1D4ED8", "#7C3AED", "#B4322A", "#B27C1E", "#0F6E70", "#122A4A"];

/** Read a logo file into a downscaled data URL (kept small for storage). */
function readLogo(file: File, max = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("decode failed"));
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("no canvas"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function SettingsPage() {
  const { user, tenant, updateTenant, hasPermission } = useAuth();
  const isOwner = user?.role === "owner";
  const canBranding = isOwner || hasPermission("settings.branding");
  const canUsers = isOwner || hasPermission("users.manage");

  const [name, setName] = useState(tenant.name);

  // Demo-only editable permission matrix for managers.
  const [grants, setGrants] = useState<Record<string, Set<PermissionKey>>>(() => {
    const init: Record<string, Set<PermissionKey>> = {};
    DEMO_USERS.filter((u) => u.role === "manager").forEach((u) => {
      init[u.id] = new Set(u.permissions);
    });
    return init;
  });

  if (!canBranding && !canUsers) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center text-slate-500">
        You don't have access to settings. Ask an owner to grant it.
      </div>
    );
  }

  const toggleGrant = (uid: string, key: PermissionKey) => {
    setGrants((prev) => {
      const next = { ...prev };
      const set = new Set(next[uid]);
      set.has(key) ? set.delete(key) : set.add(key);
      next[uid] = set;
      return next;
    });
  };

  const onLogo = async (file?: File) => {
    if (!file) return;
    try {
      const dataUrl = await readLogo(file);
      updateTenant({ logoDataUri: dataUrl });
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 md:px-8 md:py-10">
      <h1 className="text-2xl font-extrabold text-slate-900 md:text-3xl">Settings</h1>
      <p className="mt-1 text-slate-500">Owner controls for {tenant.name}.</p>

      {canBranding && (
        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold text-slate-900">Company branding</h2>
          <p className="mt-1 text-sm text-slate-500">
            Your logo and color appear across the whole portal and on every report.
          </p>

          <div className="mt-5 flex items-center gap-4">
            <BrandLogo tenant={tenant} size={64} />
            <div className="flex gap-2">
              <label className="cursor-pointer rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Upload logo
                <input type="file" accept="image/*" className="hidden" onChange={(e) => onLogo(e.target.files?.[0])} />
              </label>
              {tenant.logoDataUri && (
                <button
                  onClick={() => updateTenant({ logoDataUri: undefined })}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-slate-400 hover:text-slate-700"
                >
                  Remove
                </button>
              )}
            </div>
          </div>

          <div className="mt-6">
            <label className="mb-1 block text-sm font-medium text-slate-600">Company name</label>
            <div className="flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-slate-500"
              />
              <button
                onClick={() => updateTenant({ name: name.trim() || tenant.name })}
                className="rounded-lg px-4 py-2.5 text-sm font-semibold text-white"
                style={{ background: tenant.themeColor }}
              >
                Save
              </button>
            </div>
          </div>

          <div className="mt-6">
            <label className="mb-2 block text-sm font-medium text-slate-600">Theme color</label>
            <div className="flex flex-wrap items-center gap-2">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  onClick={() => updateTenant({ themeColor: c })}
                  aria-label={c}
                  className="h-9 w-9 rounded-full border-2 transition"
                  style={{
                    background: c,
                    borderColor: tenant.themeColor === c ? "#0f172a" : "transparent",
                  }}
                />
              ))}
              <label className="ml-1 flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm text-slate-600">
                Custom
                <input
                  type="color"
                  value={tenant.themeColor}
                  onChange={(e) => updateTenant({ themeColor: e.target.value })}
                  className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0"
                />
              </label>
            </div>
            <p className="mt-2 text-xs text-slate-400">Changes apply instantly across the portal — try it.</p>
          </div>
        </section>
      )}

      {isOwner && <DriverDevicesSection brand={tenant.themeColor} />}

      {canUsers && (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold text-slate-900">Managers &amp; permissions</h2>
          <p className="mt-1 text-sm text-slate-500">
            Grant each manager only what they need. Sensitive settings are off by default.
          </p>

          {DEMO_USERS.filter((u) => u.role === "manager").map((m) => (
            <div key={m.id} className="mt-5 rounded-xl border border-slate-200 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-800">{m.name}</div>
                  <div className="text-xs text-slate-400">{m.email}</div>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold capitalize text-slate-500">
                  {m.role}
                </span>
              </div>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {(Object.keys(PERMISSIONS) as PermissionKey[]).map((key) => {
                  const on = grants[m.id]?.has(key) ?? false;
                  const sensitive = SENSITIVE_PERMISSIONS.includes(key);
                  return (
                    <label
                      key={key}
                      className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggleGrant(m.id, key)}
                        className="h-4 w-4 rounded border-slate-300"
                        style={{ accentColor: tenant.themeColor }}
                      />
                      <span className="text-sm text-slate-700">
                        {PERMISSIONS[key]}
                        {sensitive && (
                          <span className="ml-1.5 rounded bg-amber-100 px-1 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
                            sensitive
                          </span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
          <p className="mt-4 text-xs text-slate-400">
            Owner has full access to everything, always. (Permission changes here are a working
            preview — saving to the backend arrives with the production login system.)
          </p>
        </section>
      )}
    </div>
  );
}
