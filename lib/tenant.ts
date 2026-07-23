// Multi-tenant model. Each customer company is a "tenant" with its own
// white-label branding (name, logo, theme color) and its own set of enabled
// (paid) modules. Users belong to a tenant with a role and granular permissions.
//
// INTERIM: the tenant + users below are seeded in code so we can build and demo
// the portal today. In the production phase these move to Supabase (a tenants
// table + Supabase Auth users + row-level security), but the shapes stay the same.

export type ModuleKey =
  | "fleet-inspection"
  | "fleet-van-list"
  | "fleet-maintenance"
  | "operations-driver-stats"
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
  "fleet.van_list": "Manage the van list (details, activate / inactivate)",
  "fleet.maintenance": "Manage van maintenance & costs",
  "ops.driver_stats": "View & manage driver stats",
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
  /** Admin managers see everything and act exactly like an owner. */
  admin?: boolean;
  /** Portal tabs this manager may open (owners/admins see all). */
  tabs?: Section[];
  /** LMA platform staff — master access across companies (support). */
  platformAdmin?: boolean;
}

/**
 * Per-tab security controls shown when a manager is authorized for that tab.
 * Tabs with no controls yet gain them as their modules are built.
 */
export const TAB_PERMISSIONS: Record<Section, { key: PermissionKey; label: string }[]> = {
  Fleet: [
    { key: "inspection.review", label: "Review inspections & flagged vans" },
    { key: "inspection.resolve", label: "Resolve / acknowledge issues" },
    { key: "inspection.edit_questions", label: "Edit the inspection checklist" },
    { key: "inspection.export", label: "Export reports (CSV)" },
    { key: "fleet.van_list", label: "Manage the van list (activate / inactivate)" },
    { key: "fleet.maintenance", label: "Manage van maintenance & costs" },
    { key: "reports.view", label: "View fleet reporting" },
  ],
  Operations: [{ key: "ops.driver_stats", label: "Driver stats & scorecards" }],
  "Human Resources": [],
};

/** A manager account as stored/edited by the owner in Settings. */
export interface ManagerRecord {
  id: string;
  name: string;
  email: string;
  admin: boolean;
  tabs: Section[];
  permissions: PermissionKey[];
}

export const DEFAULT_MANAGERS: ManagerRecord[] = [
  {
    id: "u_manager",
    name: "Dana Lopez",
    email: "manager@stratford.test",
    admin: false,
    tabs: ["Fleet"],
    permissions: ["inspection.review", "inspection.resolve", "reports.view"],
  },
];

/* ---- Seeded demo data (test customer) ---- */

export const DEMO_TENANT: Tenant = {
  id: "stratford",
  name: "Stratford Delivery Corp",
  slug: "stratford",
  themeColor: "#0E7C5A", // green — deliberately different from the LMA platform brand
  enabledModules: ["fleet-inspection", "fleet-van-list", "fleet-maintenance", "operations-driver-stats"],
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
  icon: "van" | "clipboard" | "wrench" | "route" | "users" | "chart";
  /** Route within the portal when the module is active. */
  href?: string;
}

export const MODULES: PortalModule[] = [
  {
    key: "fleet-inspection",
    section: "Fleet",
    name: "Vehicle Inspections",
    description: "Pre & post-trip DOT safety checks, photos, and flagged vans.",
    icon: "clipboard",
    href: "/portal/fleet",
  },
  {
    key: "fleet-van-list",
    section: "Fleet",
    name: "Van List",
    description: "Active & inactive vans — details, DVIR mileage, and service status.",
    icon: "van",
    href: "/portal/fleet/van-list",
  },
  {
    key: "fleet-maintenance",
    section: "Fleet",
    name: "Maintenance & Costs",
    description: "Log repairs by van, track cost per vehicle over the year.",
    icon: "wrench",
    href: "/portal/fleet/maintenance",
  },
  {
    key: "operations-driver-stats",
    section: "Operations",
    name: "Driver Stats",
    description: "Daily scorecards, stop bonuses, and rankings from your FedEx worksheets.",
    icon: "chart",
    href: "/portal/operations/driver-stats",
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
