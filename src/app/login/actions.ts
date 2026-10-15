"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Only allow returning to a page on this site after sign-in.
function safeNext(next: FormDataEntryValue | null): string {
  const value = typeof next === "string" ? next : "/";
  // Browsers treat "/\site" like "//site" (another website), so refuse
  // backslashes and hidden control characters as well.
  return /^\/(?![\/\\])/.test(value) && !/[\\\x00-\x1f]/.test(value) ? value : "/";
}

export async function signInWithMicrosoft(formData: FormData) {
  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? "";
  const next = safeNext(formData.get("next"));

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "azure",
    options: {
      // "profile" brings the person's name through from Microsoft.
      scopes: "email profile",
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error || !data.url) redirect("/login?error=signin");
  redirect(data.url);
}
