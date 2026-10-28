import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { features } from "@/lib/features";

export type Action = "view" | "edit" | "delete";

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string | null;
  isAdmin: boolean;
  can: (feature: string, action: Action) => boolean;
  visibleFeatureKeys: string[];
  // Home page dashboard types from the person's roles (see lib/dashboards).
  dashboards: string[];
  // False for people who may only see their own quotes, orders and invoices.
  seesAllSales: boolean;
  // Set while an admin is previewing the app as one role (see PREVIEW_COOKIE).
  previewRole: { id: string; name: string } | null;
  // FootprintAI transition tracker: what this person can do there, if anything.
  transitionAccess: "full" | "member" | "owner" | null;
};

// An admin can preview the app as a role: menus, pages, tabs and buttons
// follow that role's permissions. Only honoured for real admins, so it can
// only ever take access away. Records aren't filtered (the database still
// sees the admin), which the preview banner explains.
export const PREVIEW_COOKIE = "fp_preview_role";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The one place that works out who is signed in and what they may do.
// Cached so it runs once per request however many components call it.
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  // Signed-in pages are always rendered per request, never shared or cached.
  await connection();
  if (!isSupabaseConfigured) redirect("/login");

  const supabase = await createClient();
  // getClaims checks the sign-in token's signature. With Supabase's signing
  // keys switched on it does this locally (no trip to Supabase); otherwise it
  // asks Supabase, exactly like getUser did.
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect("/login");
  const auth = { user: { id: userId } };

  const [{ data: profile }, { data: perms }, { data: dashboards }, { data: seesAll }, { data: aiMember }, { data: transition }] = await Promise.all([
    supabase
      .from("profiles")
      .select("email, full_name, is_admin, is_active")
      .eq("id", auth.user.id)
      .single(),
    supabase.rpc("my_permissions"),
    supabase.rpc("my_dashboards"),
    supabase.rpc("sees_all_sales"),
    supabase.rpc("is_ai_member"),
    supabase.rpc("transition_access"),
  ]);

  if (!profile || !profile.is_active) redirect("/login?error=inactive");

  let granted = new Set(
    (perms ?? []).map((p: { feature: string; action: string }) => `${p.feature}:${p.action}`),
  );
  // FootprintAI is invite only: being on its list (not a role) gives view and edit.
  if (aiMember === true) granted.add("ai:view").add("ai:edit");
  // The transition tracker is for admins, Directors, its invite list and
  // anyone who owns an action (the database decides which).
  let transitionAccess: CurrentUser["transitionAccess"] =
    transition === "full" || transition === "member" || transition === "owner" ? transition : null;
  let isAdmin = profile.is_admin;
  let myDashboards = (dashboards as string[] | null) ?? [];
  let seesAllSales = isAdmin || seesAll === true;
  let previewRole: CurrentUser["previewRole"] = null;

  // Admin previewing as a role: use that role's permissions instead.
  const previewId = profile.is_admin ? (await cookies()).get(PREVIEW_COOKIE)?.value : undefined;
  if (previewId && UUID_RE.test(previewId)) {
    const [{ data: role }, { data: rolePerms }] = await Promise.all([
      supabase.from("roles").select("id, name, dashboard, own_records_only").eq("id", previewId).maybeSingle(),
      supabase.from("role_permissions").select("feature, action").eq("role_id", previewId),
    ]);
    if (role) {
      granted = new Set((rolePerms ?? []).map((p) => `${p.feature}:${p.action}`));
      isAdmin = false;
      myDashboards = role.dashboard ? [role.dashboard] : [];
      seesAllSales = granted.has("quotes:view") && !role.own_records_only;
      previewRole = { id: role.id, name: role.name };
      // Previewing: Directors see everything, any other role at most what the
      // invite list sees (no board-only actions).
      if (transitionAccess) transitionAccess = role.name === "Directors" ? "full" : "member";
    }
  }

  if (transitionAccess) granted.add("transition:view");
  const can = (feature: string, action: Action) =>
    isAdmin || granted.has(`${feature}:${action}`);

  return {
    id: auth.user.id,
    email: profile.email,
    fullName: profile.full_name,
    isAdmin,
    can,
    visibleFeatureKeys: features
      .filter((f) => (f.key === "admin" ? isAdmin : can(f.key, "view")))
      .map((f) => f.key),
    dashboards: myDashboards,
    seesAllSales,
    previewRole,
    transitionAccess,
  };
});

export async function requirePermission(feature: string, action: Action): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user.can(feature, action)) redirect("/?error=forbidden");
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user.isAdmin) redirect("/?error=forbidden");
  return user;
}
