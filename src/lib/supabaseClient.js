import { createClient } from "@supabase/supabase-js";

const rawUrl = (import.meta.env.VITE_SUPABASE_URL || "").trim();
const configuredUrl = rawUrl && !/^https?:\/\//i.test(rawUrl) && /^[a-z0-9-]+$/i.test(rawUrl)
  ? `https://${rawUrl}.supabase.co`
  : rawUrl;
const parsedUrl = (() => {
  try {
    return new URL(configuredUrl);
  } catch {
    return null;
  }
})();
const normalizedUrl = parsedUrl && /^\/(?:rest\/v1|auth\/v1)\/?$/i.test(parsedUrl.pathname)
  ? parsedUrl.origin
  : configuredUrl;
const configuredKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  ""
).trim();

function isServiceRoleKey(key) {
  if (key.startsWith("sb_secret_")) return true;
  const payload = key.split(".")[1];
  if (!payload) return false;
  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")));
    return decoded.role === "service_role";
  } catch {
    return false;
  }
}

export const supabaseConfigError = !configuredUrl || !configuredKey
  ? "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to the project root .env.local file, then restart Vite."
  : !parsedUrl || !/^https?:$/.test(parsedUrl.protocol) || (parsedUrl.pathname !== "/" && normalizedUrl === configuredUrl)
    ? "VITE_SUPABASE_URL must be the Supabase project URL, such as https://your-project.supabase.co."
    : /your[_-]?project[_-]?ref|your-project/i.test(configuredUrl) || /^(your|replace|placeholder)/i.test(configuredKey)
      ? "The Supabase URL or key is still a placeholder. Replace it with your project's URL and publishable key."
      : isServiceRoleKey(configuredKey)
        ? "A service-role or secret key cannot be used in the frontend. Use the project's publishable key or legacy anon key."
        : "";

export const isSupabaseConfigured = !supabaseConfigError;

if (import.meta.env.DEV && supabaseConfigError) {
  console.error(supabaseConfigError);
}

export const supabase = isSupabaseConfigured
  ? createClient(normalizedUrl.replace(/\/$/, ""), configuredKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
