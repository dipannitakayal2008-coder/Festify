import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { createClient } from "@supabase/supabase-js";

const demoAccounts = [
  { studentId: "SEEDED-STUDENT-001", fullName: "Festify Seeded Student", role: "student" },
  { studentId: "SEEDED-ORGANIZER-001", fullName: "Festify Seeded Organizer", role: "organizer" },
  { studentId: "SEEDED-ADMIN-001", fullName: "Festify Seeded Admin", role: "admin" },
];

function parseEnvFile(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || match[1].startsWith("#")) continue;
    values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return values;
}

function createPassword() {
  return `${randomBytes(18).toString("base64url")}aA1!`;
}

function isServiceRoleKey(key) {
  if (key.startsWith("sb_secret_")) return true;
  const payload = key.split(".")[1];
  if (!payload) return false;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return claims.role === "service_role";
  } catch {
    return false;
  }
}

function assertResult({ data, error }, description) {
  if (error) throw new Error(`${description}: ${error.message}`);
  return data;
}

async function main() {
  let envText;
  try {
    envText = await readFile(new URL("../.env.seed.local", import.meta.url), "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error("Create .env.seed.local from .env.seed.example and add the project URL and service-role key.");
    }
    throw new Error("Could not read .env.seed.local.");
  }

  const env = parseEnvFile(envText);
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(".env.seed.local must contain SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  if (!isServiceRoleKey(env.SUPABASE_SERVICE_ROLE_KEY)) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY must be a Supabase server-side service-role key. Never put it in a VITE_ variable.");
  }

  const readline = createInterface({ input: stdin, output: stdout });
  const phones = new Set();
  try {
    for (const account of demoAccounts) {
      const phone = (await readline.question(`${account.studentId} phone in E.164 format: `)).trim();
      if (!/^\+[1-9][0-9]{7,14}$/.test(phone)) {
        throw new Error(`The phone number for ${account.studentId} must use E.164 format.`);
      }
      if (phones.has(phone)) {
        throw new Error("Each demo account must use a different phone number.");
      }
      account.phone = phone;
      account.password = createPassword();
      phones.add(phone);
    }
  } finally {
    readline.close();
  }

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const ids = demoAccounts.map((account) => account.studentId);
  const phoneNumbers = demoAccounts.map((account) => account.phone);
  const existingIds = assertResult(
    await supabase.from("login_roster").select("student_id").in("student_id", ids),
    "Could not check the demo IDs in login_roster"
  );
  const existingPhones = assertResult(
    await supabase.from("login_roster").select("student_id").in("phone_e164", phoneNumbers),
    "Could not check demo phone numbers in login_roster"
  );
  if (existingIds.length || existingPhones.length) {
    throw new Error("A demo ID or phone number already exists in login_roster. Resolve the existing record before seeding.");
  }

  const created = [];
  try {
    for (const account of demoAccounts) {
      assertResult(
        await supabase.from("login_roster").insert({
          student_id: account.studentId,
          full_name: account.fullName,
          phone_e164: account.phone,
          role: account.role,
          active: true,
        }),
        `Could not add ${account.studentId} to the roster`
      );
      created.push({ account, authUserId: null });

      const { data: userData, error: userError } = await supabase.auth.admin.createUser({
        phone: account.phone,
        phone_confirm: true,
        user_metadata: {
          full_name: account.fullName,
          student_id: account.studentId,
        },
        password: account.password,
      });
      if (userError || !userData.user) {
        throw new Error(`Could not create ${account.studentId}: ${userError?.message || "Supabase returned no user."}`);
      }
      created.at(-1).authUserId = userData.user.id;

      assertResult(
        await supabase.from("profiles").upsert(
          { id: userData.user.id, full_name: account.fullName },
          { onConflict: "id" }
        ),
        `Could not create the profile for ${account.studentId}`
      );

      const roleRows = assertResult(
        await supabase.from("user_roles").select("user_id").eq("user_id", userData.user.id),
        `Could not check the role for ${account.studentId}`
      );
      if (roleRows.length) {
        assertResult(
          await supabase.from("user_roles").update({ role: account.role }).eq("user_id", userData.user.id),
          `Could not set the role for ${account.studentId}`
        );
      } else {
        assertResult(
          await supabase.from("user_roles").insert({ user_id: userData.user.id, role: account.role }),
          `Could not set the role for ${account.studentId}`
        );
      }
    }

    console.log("\nDemo credentials (shown once; save them in a secure local password manager):");
    for (const account of demoAccounts) {
      console.log(`${account.role}: ID ${account.studentId} | password ${account.password}`);
    }
  } catch (error) {
    const cleanupErrors = [];
    for (const entry of created.reverse()) {
      if (entry.authUserId) {
        const { error: deleteUserError } = await supabase.auth.admin.deleteUser(entry.authUserId);
        if (deleteUserError) cleanupErrors.push(`Could not remove the partial Auth account for ${entry.account.studentId}.`);
      }
      const { error: deleteRosterError } = await supabase
        .from("login_roster")
        .delete()
        .eq("student_id", entry.account.studentId);
      if (deleteRosterError) cleanupErrors.push(`Could not remove the partial roster row for ${entry.account.studentId}.`);
    }
    if (cleanupErrors.length) {
      throw new Error(`${error.message} Cleanup also failed: ${cleanupErrors.join(" ")}`);
    }
    throw error;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Demo account seeding failed.");
  process.exitCode = 1;
});
