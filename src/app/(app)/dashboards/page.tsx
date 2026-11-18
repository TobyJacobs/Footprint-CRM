import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { allowedTabs } from "@/lib/dashboards/analytics";

// Open the first dashboard this person is allowed to see.
export default async function DashboardsIndex() {
  const user = await getCurrentUser();
  const [first] = allowedTabs(user);
  redirect(first ? `/dashboards/${first}` : "/?error=forbidden");
}
