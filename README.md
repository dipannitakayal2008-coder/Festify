# Festify

Festify is a React + Vite campus-events frontend connected to Supabase Auth and the existing `profiles`, `user_roles`, `events`, and `registrations` tables.

## Local setup

1. Copy `.env.example` to `.env.local` in this project root.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to your Supabase project's URL and publishable key.
3. If the project still uses the legacy public anon key, `VITE_SUPABASE_ANON_KEY` remains supported as a fallback.
4. Restart the Vite server after changing environment variables.

Do not use a service-role key in the browser. The browser uses Supabase's persistent Auth session and never assigns roles itself.

## Data and authorization

- The configured public API exposes `profiles.id` and `profiles.full_name`; role records use `user_roles.user_id` and `user_roles.role`.
- The existing `events` table exposes `id`, `title`, `description`, `category`, `event_date`, `venue`, `capacity`, `status`, and `organizer_id`. Event cards and submissions use those columns; the current table has no time column.
- Events are read from `events` and filtered for each workspace after the query. Organizer views require an event's `organizer_id` to match the signed-in user. Row Level Security remains the authorization boundary.
- Event submissions use the existing `events` table, set the verified `organizer_id`, start as `pending`, and are editable only under existing policies.
- Student registration calls `register_for_event` with `p_event_id`; the frontend does not write to `registrations`.
- Profile provisioning and student-role assignment must remain in the existing secure database trigger/backend setup.

Configure the site's actual application origin in Supabase Auth URL settings and allow that same origin as a redirect URL for verification and password recovery.

The browser's public API cannot inspect PostgreSQL trigger catalogs, so verify profile/default-role trigger setup in the Supabase SQL Editor with this read-only diagnostic:

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
      and table_class.relname in ('profiles', 'user_roles')
    )
  )
order by trigger_ns.nspname, table_class.relname, trigger_info.tgname;
```

Confirm the auth-user trigger invokes a trusted function that creates the profile from `raw_user_meta_data.full_name` and assigns only the default `student` role. Do not add a browser-side role insert or change existing RLS policies.
