"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  DEMO_TENANT,
  DEMO_USERS,
  type ManagerRecord,
  type PermissionKey,
  type PortalUser,
  type Section,
  type Tenant,
} from "@/lib/tenant";

/**
 * INTERIM auth + tenant context.
 *
 * The signed-in user and white-label branding live in localStorage so the
 * portal works end-to-end today. Owner sign-in matches the demo owner;
 * manager sign-in matches the owner-managed list in /api/managers. Replaced
 * by Supabase Auth in the production phase — the hook surface stays the same.
 */

const SESSION_KEY = "lma.session.user";
const TENANT_KEY = "lma.tenant.override";

interface AuthValue {
  ready: boolean;
  user: PortalUser | null;
  tenant: Tenant;
  /** True when signed in with a real per-user account (not the shared password). */
  realSession: boolean;
  login: (email: string) => Promise<{ ok: boolean; error?: string }>;
  /** Sign in: real account first, legacy shared-password flow as fallback. */
  loginWithPassword: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  hasPermission: (key: PermissionKey) => boolean;
  /** Whether the signed-in user may open a portal tab (section). */
  canSeeSection: (section: Section) => boolean;
  updateTenant: (patch: Partial<Tenant>) => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<PortalUser | null>(null);
  const [tenant, setTenant] = useState<Tenant>(DEMO_TENANT);
  const [realSession, setRealSession] = useState(false);

  useEffect(() => {
    const restoreLegacy = () => {
      try {
        const savedUser = localStorage.getItem(SESSION_KEY);
        if (savedUser) setUser(JSON.parse(savedUser));
        const savedTenant = localStorage.getItem(TENANT_KEY);
        if (savedTenant) {
          // The saved override carries white-label branding only — module
          // entitlements always come from the platform, otherwise a stale
          // browser copy would keep newly enabled modules "coming soon".
          setTenant({
            ...DEMO_TENANT,
            ...JSON.parse(savedTenant),
            enabledModules: DEMO_TENANT.enabledModules,
          });
        }
      } catch {
        /* ignore corrupt storage */
      }
    };

    // Real account session first (httpOnly cookie), legacy storage otherwise.
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) {
          setUser(d.user as PortalUser);
          if (d.tenant) setTenant(d.tenant as Tenant);
          setRealSession(true);
        } else {
          restoreLegacy();
        }
      })
      .catch(restoreLegacy)
      .finally(() => setReady(true));
  }, []);

  const establish = (u: PortalUser) => {
    setUser(u);
    localStorage.setItem(SESSION_KEY, JSON.stringify(u));
  };

  const login: AuthValue["login"] = async (email) => {
    const e = email.trim().toLowerCase();

    const owner = DEMO_USERS.find((u) => u.role === "owner" && u.email.toLowerCase() === e);
    if (owner) {
      establish(owner);
      return { ok: true };
    }

    try {
      const res = await fetch("/api/managers");
      const data = await res.json();
      const match = ((data.managers ?? []) as ManagerRecord[]).find(
        (m) => m.email.trim().toLowerCase() === e
      );
      if (match) {
        establish({
          id: match.id,
          name: match.name,
          email: match.email,
          role: "manager",
          tenantId: DEMO_TENANT.id,
          permissions: match.permissions,
          admin: match.admin,
          tabs: match.tabs,
        });
        return { ok: true };
      }
    } catch {
      /* fall through */
    }
    return { ok: false, error: "No account found for that email." };
  };

  const loginWithPassword: AuthValue["loginWithPassword"] = async (email, password) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.user) {
        setUser(data.user as PortalUser);
        if (data.tenant) setTenant(data.tenant as Tenant);
        setRealSession(true);
        return { ok: true };
      }
      if (res.ok && data.legacy) {
        // Shared team password accepted — resolve the account the legacy way.
        return login(email);
      }
      return { ok: false, error: data.error ?? "Incorrect email or password." };
    } catch {
      return { ok: false, error: "Something went wrong. Please try again." };
    }
  };

  const logout = () => {
    setUser(null);
    setRealSession(false);
    localStorage.removeItem(SESSION_KEY);
    fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  };

  const hasPermission: AuthValue["hasPermission"] = (key) => {
    if (!user) return false;
    if (user.role === "owner" || user.admin) return true;
    return user.permissions.includes(key);
  };

  const canSeeSection: AuthValue["canSeeSection"] = (section) => {
    if (!user) return false;
    if (user.role === "owner" || user.admin) return true;
    return (user.tabs ?? []).includes(section);
  };

  const updateTenant: AuthValue["updateTenant"] = (patch) => {
    setTenant((prev) => {
      const next = { ...prev, ...patch };
      // Persist branding only; never freeze module entitlements into storage.
      const { enabledModules: _skip, ...persistable } = next;
      localStorage.setItem(TENANT_KEY, JSON.stringify(persistable));
      return next;
    });
    // Real accounts persist branding to the company record (server keeps it
    // for every device); fire-and-forget, browser copy already updated.
    if (realSession) {
      fetch("/api/company", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: patch.name,
          themeColor: patch.themeColor,
          logoDataUri: patch.logoDataUri,
        }),
      }).catch(() => {});
    }
  };

  const value = useMemo<AuthValue>(
    () => ({
      ready,
      user,
      tenant,
      realSession,
      login,
      loginWithPassword,
      logout,
      hasPermission,
      canSeeSection,
      updateTenant,
    }),
    [ready, user, tenant, realSession] // eslint-disable-line react-hooks/exhaustive-deps
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
