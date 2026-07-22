import { redirect } from "next/navigation";

// The old standalone dashboard now lives inside the portal.
export default function DashboardRedirect() {
  redirect("/portal/fleet/inspections");
}
