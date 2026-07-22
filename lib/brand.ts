// The platform brand (Last Mile Assist). This is the product itself — the
// public marketing site and the login live under this brand. Once a customer
// logs in, their own white-label brand (see lib/tenant.ts) takes over.

export const PLATFORM = {
  name: "Last Mile Assist",
  shortName: "LMA",
  domain: "lastmileassist.com",
  tagline: "One portal to run your whole delivery operation.",
  subtagline:
    "Fleet inspections, operations, and HR in a single system built for last-mile contractors — less overhead, fewer logins, real accountability.",
  emails: {
    info: "info@lastmileassist.com",
    contact: "contact@lastmileassist.com",
    help: "help@lastmileassist.com",
  },
  // Platform identity colors (distinct from any customer's white-label theme).
  navy: "#122A4A",
  navyDeep: "#0C1D34",
  amber: "#F5A623",
} as const;
