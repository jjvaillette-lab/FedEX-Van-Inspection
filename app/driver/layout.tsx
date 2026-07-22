import type { Metadata } from "next";

// The driver surface installs as its own app: "Add to Home Screen" uses this
// manifest, so the icon opens the driver hub (/driver) — never the website.
export const metadata: Metadata = {
  title: "Van Check — Driver",
  manifest: "/driver-manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Van Check",
  },
};

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  return children;
}
