create table if not exists public.login_roster (
  student_id text primary key
    check (student_id = upper(btrim(student_id)))
    check (student_id ~ '^[A-Z0-9._-]{3,64}$'),
  full_name text not null
    check (length(btrim(full_name)) between 1 and 100),
  phone_e164 text not null unique
    check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  role text not null
    check (role in ('student', 'organizer', 'admin')),
  active boolean not null default true,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.login_roster enable row level security;
revoke all on table public.login_roster from anon, authenticated;
grant all on table public.login_roster to service_role;

create or replace function public.link_roster_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.phone is not null and new.phone_confirmed_at is not null then
    update public.login_roster
    set auth_user_id = new.id
    where phone_e164 = new.phone
      and student_id = upper(btrim(new.raw_user_meta_data ->> 'student_id'))
      and active
      and (auth_user_id is null or auth_user_id = new.id);
  end if;

  return new;
end;
$$;

revoke all on function public.link_roster_auth_user() from public, anon, authenticated;

drop trigger if exists link_roster_auth_user on auth.users;
create trigger link_roster_auth_user
after insert or update of phone, phone_confirmed_at on auth.users
for each row
execute function public.link_roster_auth_user();
