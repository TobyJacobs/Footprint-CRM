import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { allowedTabs, type DashboardTab } from "@/lib/dashboards/analytics";

// Each dashboard page checks its own tab, so a link can't reach one the
// person isn't allowed to see.
export async function requireTab(tab: DashboardTab) {
  const user = await getCurrentUser();
  if (!allowedTabs(user).includes(tab)) redirect("/dashboards");
  return user;
}
