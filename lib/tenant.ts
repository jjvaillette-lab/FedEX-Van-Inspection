// Multi-tenant model. Each customer company is a "tenant" with its own
// white-label branding (name, logo, theme color) and its own set of enabled
// (paid) modules. Users belong to a tenant with a role and granular permissions.
//
// INTERIM: the tenant + users below are seeded in code so we can build and demo
// the portal today. In the production phase these move to Supabase (a tenants
// table + Supabase Auth users + row-level security), but the shapes stay the same.

export type ModuleKey =
  | "fleet-inspection"
  | "fleet-maintenance"
  | "operations-dispatch"
  | "hr-payroll";

export type Section = "Operations" | "Fleet" | "Human Resources";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  /** Accent color that themes the whole portal + reports for this customer. */
  themeColor: string;
  /** Uploaded logo as a data URL; when absent, a default mark is shown. */
  logoDataUri?: string;
  /** Modules this customer has access to (fee-gated). */
  enabledModules: ModuleKey[];
}

export type Role = "owner" | "manager";

/** Granular capabilities an owner can grant a manager, one toggle each. */
export const PERMISSIONS = {
  "inspection.review": "Review inspections & flagged vans",
  "inspection.resolve": "Resolve / acknowledge issues",
  "inspection.edit_questions": "Edit the inspection checklist",
  "inspection.export": "Export inspection reports (PDF/CSV)",
  "fleet.maintenance": "Manage van maintenance & costs",
  "reports.view": "View the reporting tab",
  "settings.branding": "Edit company branding",
  "users.manage": "Add / manage managers & permissions",
  "billing.manage": "Manage subscription & billing",
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

/** Sensitive permissions that are OFF by default for new managers. */
export const SENSITIVE_PERMISSIONS: PermissionKey[] = [
  "inspection.edit_questions",
  "settings.branding",
  "users.manage",
  "billing.manage",
];

export interface PortalUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  tenantId: string;
  /** Granted permissions (owners implicitly have all — see hasPermission). */
  permissions: PermissionKey[];
}

/* ---- Seeded demo data (test customer) ---- */

export const DEMO_TENANT: Tenant = {
  id: "stratford",
  name: "Stratford Delivery Corp",
  slug: "stratford",
  themeColor: "#0E7C5A", // green — deliberately different from the LMA platform brand
  enabledModules: ["fleet-inspection"],
};

export const DEMO_USERS: PortalUser[] = [
  {
    id: "u_owner",
    name: "Marcus Reed",
    email: "owner@stratford.test",
    role: "owner",
    tenantId: "stratford",
    permissions: Object.keys(PERMISSIONS) as PermissionKey[],
  },
  {
    id: "u_manager",
    name: "Dana Lopez",
    email: "manager@stratford.test",
    role: "manager",
    tenantId: "stratford",
    // A fleet manager: can review & resolve, but no sensitive/back-end settings.
    permissions: ["inspection.review", "inspection.resolve", "reports.view"],
  },
];

/* ---- Module registry ---- */

export interface PortalModule {
  key: ModuleKey;
  section: Section;
  name: string;
  description: string;
  /** Icon key resolved via MODULE_ICONS in app/components/icons.tsx. */
  icon: "van" | "wrench" | "route" | "users";
  /** Route within the portal when the module is active. */
  href?: string;
}

export const MODULES: PortalModule[] = [
  {
    key: "fleet-inspection",
    section: "Fleet",
    name: "Vehicle Inspections",
    description: "Pre & post-trip DOT safety checks, photos, and flagged vans.",
    icon: "van",
    href: "/portal/fleet",
  },
  {
    key: "fleet-maintenance",
    section: "Fleet",
    name: "Maintenance & Costs",
    description: "Log repairs by van, track cost per vehicle over the year.",
    icon: "wrench",
  },
  {
    key: "operations-dispatch",
    section: "Operations",
    name: "Dispatch",
    description: "Routes, assignments, and daily operations.",
    icon: "route",
  },
  {
    key: "hr-payroll",
    section: "Human Resources",
    name: "Employee Management",
    description: "Driver records, accountability, and team oversight.",
    icon: "users",
  },
];

export const SECTIONS: Section[] = ["Operations", "Fleet", "Human Resources"];
