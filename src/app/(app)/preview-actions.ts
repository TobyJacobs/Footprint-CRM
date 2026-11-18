"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PREVIEW_COOKIE } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Start previewing the app as a role. Checks the person really is an admin
// (in the database), because getCurrentUser hides admin while previewing.
export async function startPreview(roleId: string) {
  if (!UUID_RE.test(roleId)) redirect("/admin/roles?error=Unknown%20role");
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) redirect("/?error=forbidden");
  (await cookies()).set(PREVIEW_COOKIE, roleId, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 4 });
  redirect("/");
}

// Back to normal. Safe for anyone: removing the preview can only restore access.
export async function stopPreview() {
  (await cookies()).delete(PREVIEW_COOKIE);
  redirect("/admin/roles");
}
