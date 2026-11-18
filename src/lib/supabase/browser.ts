import { createBrowserClient } from "@supabase/ssr";
import { supabasePublishableKey, supabaseUrl } from "./config";

// A Supabase client for the browser, acting as the signed-in person. Used only
// for uploading files straight to private storage (the database's rules still
// decide what each person may upload or read).
export function createBrowserSupabase() {
  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}
