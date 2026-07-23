"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/app/components/portal/AuthProvider";
import BrandLogo from "@/app/components/portal/BrandLogo";
import { IconAlert, IconPlus } from "@/app/components/icons";
import {
  SECTIONS,
  TAB_PERMISSIONS,
  type ManagerRecord,
  type PermissionKey,
  type Section,
} from "@/lib/tenant";

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
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("no canvas"));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

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
              year.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Contact-form inbox                                                  */
/* ------------------------------------------------------------------ */

interface ContactMessage {
  id: string;
  created_at: string;
  name: string;
  email: string | null;
  message: string;
  details?: {
    company?: string;
    routes?: string;
    employees?: string;
    city?: string;
    state?: string;
  } | null;
}

function MessagesSection() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [emailConfigured, setEmailConfigured] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/contact")
      .then((r) => r.json())
      .then((d) => {
        setMessages(d.messages ?? []);
        setEmailConfigured(d.emailConfigured !== false);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-bold text-slate-900">Contact form messages</h2>
      <p className="mt-1 text-sm text-slate-500">
        Every submission from the public Contact page lands here
        {emailConfigured ? " and is emailed to you." : "."}
      </p>
      {!emailConfigured && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
          Email delivery isn&apos;t connected yet (RESEND_API_KEY + CONTACT_EMAIL). Messages are
          stored here in the meantime.
        </p>
      )}
      {loading ? (
        <p className="mt-4 text-sm text-slate-400">Loading…</p>
      ) : messages.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">No messages yet.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {messages.map((m) => {
            const d = m.details ?? {};
            const facts = [
              d.company,
              d.routes && `${d.routes} routes/day`,
              d.employees && `${d.employees} employees`,
              [d.city, d.state].filter(Boolean).join(", "),
            ].filter(Boolean);
            return (
              <div key={m.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold text-slate-800">
                    {m.name}
                    {m.email && (
                      <a href={`mailto:${m.email}`} className="ml-2 text-sm font-medium text-slate-400 hover:text-slate-700">
                        {m.email}
                      </a>
                    )}
                  </p>
                  <span className="text-xs tabular-nums text-slate-400">
                    {new Date(m.created_at).toLocaleString()}
                  </span>
                </div>
                {facts.length > 0 && (
                  <p className="mt-1 text-xs font-medium text-slate-500">{facts.join(" · ")}</p>
                )}
                <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{m.message}</p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Managers & access                                                   */
/* ------------------------------------------------------------------ */

function ManagersSection({ brand }: { brand: string }) {
  const [managers, setManagers] = useState<ManagerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);
  /** Manager awaiting the second admin-rights confirmation. */
  const [adminConfirm, setAdminConfirm] = useState<ManagerRecord | null>(null);

  useEffect(() => {
    fetch("/api/managers")
      .then((r) => r.json())
      .then((d) => setManagers(d.managers ?? []))
      .finally(() => setLoading(false));
  }, []);

  const mutate = (fn: (list: ManagerRecord[]) => ManagerRecord[]) => {
    setManagers(fn);
    setDirty(true);
    setMessage(null);
  };

  const patchManager = (id: string, patch: Partial<ManagerRecord>) =>
    mutate((list) => list.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  const toggleTab = (m: ManagerRecord, section: Section) => {
    const has = m.tabs.includes(section);
    const tabs = has ? m.tabs.filter((t) => t !== section) : [...m.tabs, section];
    // Removing a tab also removes that tab's granted controls.
    const tabKeys = TAB_PERMISSIONS[section].map((p) => p.key);
    const permissions = has ? m.permissions.filter((p) => !tabKeys.includes(p)) : m.permissions;
    patchManager(m.id, { tabs, permissions });
  };

  const togglePermission = (m: ManagerRecord, key: PermissionKey) => {
    const permissions = m.permissions.includes(key)
      ? m.permissions.filter((p) => p !== key)
      : [...m.permissions, key];
    patchManager(m.id, { permissions });
  };

  const addManager = () => {
    const name = newName.trim();
    const email = newEmail.trim().toLowerCase();
    if (!name || !email) return;
    if (managers.some((m) => m.email.toLowerCase() === email)) {
      setMessage({ ok: false, text: "A manager with that email already exists." });
      return;
    }
    mutate((list) => [
      ...list,
      {
        id: `mgr_${Date.now()}`,
        name,
        email,
        admin: false, // sensitive access is always off by default
        tabs: [],
        permissions: [],
      },
    ]);
    setNewName("");
    setNewEmail("");
    setAdding(false);
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/managers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ managers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setDirty(false);
      setMessage({ ok: true, text: "Saved. Changes apply the next time each manager signs in." });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Managers &amp; access</h2>
          <p className="mt-1 text-sm text-slate-500">
            Grant access by portal tab; each authorized tab opens its own security controls.
            Everything is off by default.
          </p>
        </div>
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          style={{ background: brand }}
        >
          {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
        </button>
      </div>

      {message && (
        <p
          className={`mt-3 rounded-lg border px-4 py-2.5 text-sm ${
            message.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </p>
      )}

      {loading ? (
        <p className="mt-5 text-sm text-slate-400">Loading…</p>
      ) : (
        <>
          {managers.map((m) => (
            <div key={m.id} className="mt-5 rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-semibold text-slate-800">{m.name}</div>
                  <div className="text-xs text-slate-400">{m.email}</div>
                </div>
                <div className="flex items-center gap-3">
                  {m.admin && (
                    <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
                      Admin
                    </span>
                  )}
                  {pendingRemove === m.id ? (
                    <span className="flex items-center gap-2 text-xs">
                      <span className="text-slate-500">Remove {m.name.split(" ")[0]}?</span>
                      <button
                        onClick={() => {
                          mutate((list) => list.filter((x) => x.id !== m.id));
                          setPendingRemove(null);
                        }}
                        className="rounded bg-red-600 px-2.5 py-1 font-semibold text-white"
                      >
                        Yes, remove
                      </button>
                      <button
                        onClick={() => setPendingRemove(null)}
                        className="rounded border border-slate-300 px-2.5 py-1 font-medium text-slate-600"
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setPendingRemove(m.id)}
                      className="text-xs font-semibold text-slate-400 hover:text-red-600"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              {/* Admin toggle — second confirmation before granting */}
              <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={m.admin}
                  onChange={(e) => {
                    if (e.target.checked) setAdminConfirm(m); // confirm before granting
                    else patchManager(m.id, { admin: false });
                  }}
                  className="mt-0.5 h-4 w-4"
                  style={{ accentColor: "#B4322A" }}
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-800">
                    Admin rights
                    <span className="ml-1.5 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-red-700">
                      full access
                    </span>
                  </span>
                  <span className="block text-xs text-slate-500">
                    Sees every tab and acts exactly like an owner. Off by default.
                  </span>
                </span>
              </label>

              {/* Tab access + per-tab security */}
              {!m.admin && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Portal tabs
                  </p>
                  {SECTIONS.map((section) => {
                    const authorized = m.tabs.includes(section);
                    const controls = TAB_PERMISSIONS[section];
                    return (
                      <div key={section} className="rounded-lg border border-slate-200">
                        <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={authorized}
                            onChange={() => toggleTab(m, section)}
                            className="h-4 w-4"
                            style={{ accentColor: brand }}
                          />
                          <span className="text-sm font-semibold text-slate-800">{section}</span>
                        </label>
                        {authorized && (
                          <div className="border-t border-slate-100 px-3 py-2.5 pl-9">
                            {controls.length === 0 ? (
                              <p className="text-xs text-slate-400">
                                Controls for this tab will appear here as its modules are built.
                              </p>
                            ) : (
                              <div className="grid gap-1.5 sm:grid-cols-2">
                                {controls.map((c) => (
                                  <label key={c.key} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-slate-50">
                                    <input
                                      type="checkbox"
                                      checked={m.permissions.includes(c.key)}
                                      onChange={() => togglePermission(m, c.key)}
                                      className="h-3.5 w-3.5"
                                      style={{ accentColor: brand }}
                                    />
                                    <span className="text-[13px] text-slate-700">{c.label}</span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}

          {/* Add manager */}
          {adding ? (
            <div className="mt-4 rounded-xl border border-slate-300 p-4">
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Full name"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                />
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Email (used to sign in)"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                />
                <button
                  onClick={addManager}
                  disabled={!newName.trim() || !newEmail.trim()}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                  style={{ background: brand }}
                >
                  Add
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                New managers start with no access — authorize tabs above, then Save.
              </p>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold"
              style={{ color: brand }}
            >
              <IconPlus size={15} /> Add manager
            </button>
          )}
        </>
      )}

      {/* Second safety confirmation for admin rights */}
      {adminConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-5">
          <div className="w-full max-w-md rounded-xl bg-white p-6">
            <div className="flex items-center gap-2 text-red-600">
              <IconAlert size={22} />
              <h3 className="text-lg font-bold text-slate-900">Grant admin rights?</h3>
            </div>
            <p className="mt-3 text-sm text-slate-600">
              <strong>{adminConfirm.name}</strong> will see every tab and every record, and can act
              exactly like an owner — including managing other managers, branding, and settings.
            </p>
            <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              This is a full-access grant. Only continue if you trust this person with everything
              in the portal.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                onClick={() => setAdminConfirm(null)}
                className="rounded-lg border border-slate-300 py-2.5 text-sm font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  patchManager(adminConfirm.id, { admin: true });
                  setAdminConfirm(null);
                }}
                className="rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white"
              >
                Yes, grant admin
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function SettingsPage() {
  const { user, tenant, updateTenant, hasPermission } = useAuth();
  const isOwner = user?.role === "owner" || !!user?.admin;
  const canBranding = isOwner || hasPermission("settings.branding");
  const canUsers = isOwner || hasPermission("users.manage");

  const [name, setName] = useState(tenant.name);

  if (!canBranding && !canUsers) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center text-slate-500">
        You don&apos;t have access to settings. Ask an owner to grant it.
      </div>
    );
  }

  const onLogo = async (file?: File) => {
    if (!file) return;
    try {
      updateTenant({ logoDataUri: await readLogo(file) });
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 md:px-8 md:py-10">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h1>
      <p className="mt-1 text-sm text-slate-500">Owner controls for {tenant.name}.</p>

      {canBranding && (
        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold text-slate-900">Company branding</h2>
          <p className="mt-1 text-sm text-slate-500">
            Your logo and color appear across the whole portal and on every report. Changes apply
            immediately.
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
          </div>
        </section>
      )}

      {isOwner && <DriverDevicesSection brand={tenant.themeColor} />}

      {canUsers && <ManagersSection brand={tenant.themeColor} />}

      {isOwner && <MessagesSection />}
    </div>
  );
}
