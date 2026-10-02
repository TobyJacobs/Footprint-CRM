import "server-only";
import { cache } from "react";
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
};

// The one place that works out who is signed in and what they may do.
// Cached so it runs once per request however many components call it.
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  // Signed-in pages are always rendered per request, never shared or cached.
  await connection();
  if (!isSupabaseConfigured) redirect("/login");

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const [{ data: profile }, { data: perms }, { data: dashboards }] = await Promise.all([
    supabase
      .from("profiles")
      .select("email, full_name, is_admin, is_active")
      .eq("id", auth.user.id)
      .single(),
    supabase.rpc("my_permissions"),
    supabase.rpc("my_dashboards"),
  ]);

  if (!profile || !profile.is_active) redirect("/login?error=inactive");

  const granted = new Set(
    (perms ?? []).map((p: { feature: string; action: string }) => `${p.feature}:${p.action}`),
  );
  const isAdmin = profile.is_admin;
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
    dashboards: (dashboards as string[] | null) ?? [],
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
