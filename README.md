# Festify

Festify is a React + Vite campus-events website.

## Current no-login demo mode

The site opens on a login page with separate Student, Organizer, and Admin sections. Use the account ID and password for the selected section. This is a local demo login, not production authentication.

The site uses sample data in the running browser session and does not connect to Supabase or write live data. Event submissions, approvals, registrations, venue floor plans, check-in tickets, participation stars, certificates, and personalized recommendations are demo-only. Reloading the page resets the login session. Student event reminders are saved in that browser's local storage; browser notifications are delivered while Festify is open and notification permission is allowed. A real OpenAI model is not called; recommendations are generated locally from prior participation categories.

After signing in, the left sidebar shows navigation for the selected role; **Settings** and **Log out** are at the bottom of that sidebar. Students can set reminders for upcoming events (one day, one hour, or 15 minutes before) and remove them from the Reminders section. Organizers enter the venue, precise location or directions URL, event date, and start/end times when creating or editing an event. They can also upload a PNG, JPEG, or WebP floor plan (up to 5 MB), then click the map preview to place the room pin. Students can see the location and time and open directions from each event card. Organizers also see each event's unique-student registration count and capacity. These details and uploaded images are demo-only and retained in the current browser session.

### Try the demo

1. Register for an approved event in Student.
2. Show the check-in QR and copy its manual ticket text.
3. Switch to Organizer, open the event scanner, and paste the ticket text to verify attendance.
4. Switch back to Student to see the 3-star reward and download the participation certificate.
5. In Organizer, create an event, upload a floor-plan image, and click the map preview to place its room pin. Switch to Admin to approve it.
6. In Student, choose a reminder lead time on an upcoming event card and select **Set reminder**. Allow browser notifications if prompted.

Local demo data is isolated to the current browser and is not suitable for real attendance verification or multi-device use. Authentication, persistent event storage, server-verified attendance, reminders when the app is closed, and external AI recommendations need a trusted backend before production use.

## Optional Supabase setup

1. Copy `.env.example` to `.env.local` in this project root.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to your Supabase project's URL and publishable key.
3. If the project still uses the legacy public anon key, `VITE_SUPABASE_ANON_KEY` remains supported as a fallback.
4. Restart the Vite server after changing environment variables.

The current no-login demo works without Supabase configuration. Supabase setup below applies only when preparing the separate authenticated backend integration. Never place a service-role key in the browser.

## Future authenticated backend setup

The current website does not use authentication. The following instructions are for restoring an authenticated backend later. Students, organizers, and administrators can sign in with a campus ID and password. The ID-to-phone mapping stays in the server-only `login_roster` table; the browser never receives roster phone numbers. Students can create an account only when an active student ID is present in the approved roster. Organizer and admin accounts must be provisioned by a trusted administrator.

1. Link the Supabase CLI to the project with `supabase link --project-ref <project-ref>`, then apply `supabase/migrations/20261028000000_id_login_roster.sql` with `supabase db push`.
2. Deploy the `id-auth` Supabase Edge Function with `supabase functions deploy id-auth`. The function uses Supabase's server-managed `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`; never add the service-role key to a `VITE_` variable or browser code.
3. Import an approved CSV into `login_roster` with columns `student_id`, `full_name`, `phone_e164`, `role`, and `active`. IDs should be uppercase; phone numbers must use E.164 format (for example, `+15551234567`). Use `student`, `organizer`, or `admin` for `role`. Do not commit real roster data.
4. In Supabase **Authentication > Providers**, enable Phone. Configure an SMS provider before testing signup or password recovery. In **Authentication > Rate Limits**, review SMS limits.
5. Student signup sends an SMS OTP to the phone in the approved roster. Password recovery also verifies the roster phone by SMS. Supabase Auth URL settings are not used for these OTP flows.

If the app says the ID login function cannot be reached, check that the Supabase CLI is linked to the same project URL configured in `.env.local`, then run `supabase db push` and `supabase functions deploy id-auth`. A missing deployed function returns HTTP 404 from `/functions/v1/id-auth`.

After applying the migration and deploying the function, copy `.env.seed.example` to `.env.seed.local`, add the project URL and service-role key locally, then run `npm run seed:demo`. The script prompts for three phone numbers in E.164 format, creates `SEEDED-STUDENT-001`, `SEEDED-ORGANIZER-001`, and `SEEDED-ADMIN-001`, and generates random passwords printed once to the terminal. These are real Supabase test accounts; use numbers you control if you want SMS password recovery to work. The seed file and credentials are not committed. Never use demo accounts or passwords in production.

## Existing Supabase backend notes

- When a trusted backend is reconnected, its public API should expose `profiles.id` and `profiles.full_name`; role records use `user_roles.user_id` and `user_roles.role`.
- The existing `events` table exposes `id`, `title`, `description`, `category`, `event_date`, `venue`, `capacity`, `status`, and `organizer_id`.
- Keep event ownership, registration, and role authorization in Supabase Row Level Security and trusted server-side code; do not expose privileged writes in an unauthenticated browser.
- Profile provisioning and role assignment should remain in secure database triggers/backend setup.

When reconnecting the authenticated backend, the browser's public API cannot inspect PostgreSQL trigger catalogs. Verify profile/default-role provisioning and roster-link triggers in the Supabase SQL Editor with this read-only diagnostic:

```sql
select
  trigger_ns.nspname as table_schema,
  table_class.relname as table_name,
  trigger_info.tgname as trigger_name,
  pg_get_triggerdef(trigger_info.oid) as trigger_definition,
  function_ns.nspname as function_schema,
  trigger_function.proname as function_name,
  pg_get_functiondef(trigger_function.oid) as function_definition
from pg_trigger as trigger_info
join pg_class as table_class on table_class.oid = trigger_info.tgrelid
join pg_namespace as trigger_ns on trigger_ns.oid = table_class.relnamespace
join pg_proc as trigger_function on trigger_function.oid = trigger_info.tgfoid
join pg_namespace as function_ns on function_ns.oid = trigger_function.pronamespace
where not trigger_info.tgisinternal
  and (
    (trigger_ns.nspname = 'auth' and table_class.relname = 'users')
    or (
      trigger_ns.nspname = 'public'
      and table_class.relname in ('profiles', 'user_roles', 'login_roster')
    )
  )
order by trigger_ns.nspname, table_class.relname, trigger_info.tgname;
```

Confirm the auth-user triggers create the profile from `raw_user_meta_data.full_name`, assign only the default `student` role to self-signups, and link a roster entry only after its phone is verified. Do not add a browser-side role insert or change existing RLS policies.
