"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  DEMO_TENANT,
  DEMO_USERS,
  type PermissionKey,
  type PortalUser,
  type Tenant,
} from "@/lib/tenant";

/**
 * INTERIM auth + tenant context.
 *
 * Holds the signed-in user and the current customer's white-label branding in
 * the browser (localStorage) so the whole portal is clickable today without a
 * backend. In production this is replaced by Supabase Auth + a tenants table;
 * the hook surface (user, tenant, login, logout, hasPermission, updateTenant)
 * stays the same so pages don't change.
 */

const SESSION_KEY = "lma.session.user";
const TENANT_KEY = "lma.tenant.override";

interface AuthValue {
  ready: boolean;
  user: PortalUser | null;
  tenant: Tenant;
  login: (email: string) => { ok: boolean; error?: string };
  logout: () => void;
  hasPermission: (key: PermissionKey) => boolean;
  updateTenant: (patch: Partial<Tenant>) => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<PortalUser | null>(null);
  const [tenant, setTenant] = useState<Tenant>(DEMO_TENANT);

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem(SESSION_KEY);
      if (savedUser) setUser(JSON.parse(savedUser));
      const savedTenant = localStorage.getItem(TENANT_KEY);
      if (savedTenant) setTenant({ ...DEMO_TENANT, ...JSON.parse(savedTenant) });
    } catch {
      /* ignore corrupt storage */
    }
    setReady(true);
  }, []);

  const login: AuthValue["login"] = (email) => {
    const match = DEMO_USERS.find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase()
    );
    if (!match) return { ok: false, error: "No account found for that email." };
    setUser(match);
    localStorage.setItem(SESSION_KEY, JSON.stringify(match));
    return { ok: true };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
  };

  const hasPermission: AuthValue["hasPermission"] = (key) => {
    if (!user) return false;
    if (user.role === "owner") return true;
    return user.permissions.includes(key);
  };

  const updateTenant: AuthValue["updateTenant"] = (patch) => {
    setTenant((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem(TENANT_KEY, JSON.stringify(next));
      return next;
    });
  };

  const value = useMemo<AuthValue>(
    () => ({ ready, user, tenant, login, logout, hasPermission, updateTenant }),
    [ready, user, tenant]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
