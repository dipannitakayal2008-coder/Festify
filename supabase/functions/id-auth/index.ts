import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const genericCredentialsError = "The ID or password is incorrect, or this account is not ready. Check your details or contact an administrator.";

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeId(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function isValidPassword(value: unknown) {
  return typeof value === "string" && value.length >= 8 && value.length <= 128;
}

function isValidOtp(value: unknown) {
  return typeof value === "string" && /^[0-9]{4,10}$/.test(value.trim());
}

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error("ID auth function is missing Supabase server configuration.");
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const authClient = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findRosterEntry(studentId: string) {
  const { data, error } = await adminClient
    .from("login_roster")
    .select("student_id, full_name, phone_e164, role, active, auth_user_id")
    .eq("student_id", studentId)
    .eq("active", true)
    .maybeSingle();

  if (error) throw new Error("ROSTER_LOOKUP_FAILED");
  return data;
}

function sessionResponse(session: {
  access_token: string;
  refresh_token: string;
} | null) {
  if (!session?.access_token || !session.refresh_token) {
    return response({ error: "Authentication did not return a session. Please try again." }, 401);
  }
  return response({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return response({ error: "Method not allowed." }, 405);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return response({ error: "A valid JSON request is required." }, 400);
  }

  const action = payload.action;
  const studentId = normalizeId(payload.studentId);
  if (!studentId || !/^[A-Z0-9._-]{3,64}$/.test(studentId)) {
    return response({ error: genericCredentialsError }, 400);
  }

  try {
    const rosterEntry = await findRosterEntry(studentId);

    if (action === "signup") {
      if (
        !rosterEntry ||
        rosterEntry.role !== "student" ||
        rosterEntry.auth_user_id ||
        !isValidPassword(payload.password)
      ) {
        return response({ error: genericCredentialsError }, 400);
      }

      const { data, error } = await authClient.auth.signUp({
        phone: rosterEntry.phone_e164,
        password: payload.password as string,
        options: {
          data: {
            full_name: rosterEntry.full_name,
            student_id: rosterEntry.student_id,
          },
        },
      });

      if (error && /phone provider|sms provider|unsupported phone/i.test(error.message)) {
        return response({
          error: "Phone sign-in is not ready. Enable Phone authentication and configure an SMS provider in Supabase.",
        }, 503);
      }
      if (error && /rate limit|too many requests/i.test(error.message)) {
        return response({ error: "Too many SMS requests. Wait before trying again." }, 429);
      }
      if (error || !data.user || data.user.identities?.length === 0) {
        return response({
          error: "Unable to start signup. Check the ID or contact an administrator.",
        }, 400);
      }
      return response({ message: "If this ID is eligible, a verification code has been sent to its registered phone." });
    }

    if (action === "resend-signup") {
      if (!rosterEntry || rosterEntry.role !== "student" || rosterEntry.auth_user_id) {
        return response({ message: "If this ID has a pending signup, a new code has been requested." });
      }
      const { error } = await authClient.auth.resend({
        type: "sms",
        phone: rosterEntry.phone_e164,
      });
      if (error) {
        return response({ error: "The verification code could not be resent. Check SMS setup or wait before retrying." }, 429);
      }
      return response({ message: "If this ID has a pending signup, a new code has been requested." });
    }

    if (action === "verify-signup") {
      if (
        !rosterEntry ||
        rosterEntry.role !== "student" ||
        rosterEntry.auth_user_id ||
        !isValidOtp(payload.otp)
      ) {
        return response({ error: "The ID or verification code is invalid, or the account is not eligible." }, 400);
      }

      const { data, error } = await authClient.auth.verifyOtp({
        phone: rosterEntry.phone_e164,
        token: (payload.otp as string).trim(),
        type: "sms",
      });
      if (error || !data.user || !data.session) {
        return response({ error: "The verification code is invalid or expired. Request a new code and try again." }, 400);
      }

      const { data: linkedEntry, error: linkError } = await adminClient
        .from("login_roster")
        .select("auth_user_id")
        .eq("student_id", studentId)
        .maybeSingle();
      if (linkError || linkedEntry?.auth_user_id !== data.user.id) {
        return response({ error: "Your phone was verified, but your roster account could not be linked. Contact an administrator." }, 500);
      }
      return sessionResponse(data.session);
    }

    if (action === "signin") {
      if (!rosterEntry || !rosterEntry.auth_user_id || !isValidPassword(payload.password)) {
        return response({ error: genericCredentialsError }, 401);
      }
      const { data, error } = await authClient.auth.signInWithPassword({
        phone: rosterEntry.phone_e164,
        password: payload.password as string,
      });
      if (error || !data.session) {
        return response({ error: genericCredentialsError }, 401);
      }
      return sessionResponse(data.session);
    }

    if (action === "recovery-send") {
      if (!rosterEntry || !rosterEntry.auth_user_id) {
        return response({ message: "If the ID belongs to an active account, a recovery code has been requested." });
      }
      const { error } = await authClient.auth.signInWithOtp({
        phone: rosterEntry.phone_e164,
        options: { shouldCreateUser: false },
      });
      if (error) {
        return response({ error: "A recovery code could not be sent. Check that phone authentication and an SMS provider are configured, or wait before retrying." }, 503);
      }
      return response({ message: "If the ID belongs to an active account, a recovery code has been requested." });
    }

    if (action === "recovery-verify") {
      if (!rosterEntry || !rosterEntry.auth_user_id || !isValidOtp(payload.otp)) {
        return response({ error: "The ID or recovery code is invalid." }, 400);
      }
      const { data, error } = await authClient.auth.verifyOtp({
        phone: rosterEntry.phone_e164,
        token: (payload.otp as string).trim(),
        type: "sms",
      });
      if (error || !data.session) {
        return response({ error: "The recovery code is invalid or expired. Request a new code and try again." }, 400);
      }
      return sessionResponse(data.session);
    }

    return response({ error: "Unknown authentication action." }, 400);
  } catch (error) {
    console.error("ID authentication backend failed", error instanceof Error ? error.message : "unknown error");
    return response({ error: "ID authentication is temporarily unavailable. Try again later." }, 500);
  }
});
