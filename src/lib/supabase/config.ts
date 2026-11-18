// Supabase connection settings. These two values are safe to expose to the
// browser: the publishable key only allows what row-level security permits.
// They are set as Netlify environment variables (and in .env.local locally).
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);
