-- PennyWise Supabase schema
-- Run in Supabase Dashboard -> SQL Editor as the project owner.
-- All money data is stored in one per-user JSONB snapshot to preserve the existing
-- synchronous store.js accounting/CRUD logic during this incremental migration.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  created_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,24}$')
);

create table if not exists public.pennywise_user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint pennywise_payload_object check (jsonb_typeof(payload) = 'object')
);

alter table public.profiles enable row level security;
alter table public.pennywise_user_data enable row level security;

-- Profile rows are private. Username uniqueness is enforced by the database constraint.
drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Every authenticated operation is limited to the signed-in user's UUID.
drop policy if exists "Users can read their own finance data" on public.pennywise_user_data;
create policy "Users can read their own finance data"
  on public.pennywise_user_data for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own finance data" on public.pennywise_user_data;
create policy "Users can insert their own finance data"
  on public.pennywise_user_data for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own finance data" on public.pennywise_user_data;
create policy "Users can update their own finance data"
  on public.pennywise_user_data for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own finance data" on public.pennywise_user_data;
create policy "Users can delete their own finance data"
  on public.pennywise_user_data for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Create a profile automatically on email/password or OAuth signup.
-- Explicit signup usernames must be unique. OAuth users without a supplied username
-- receive a safe, unique handle based on the email prefix plus a random suffix.
create or replace function public.handle_new_pennywise_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  raw_username text;
  clean_username text;
  is_explicit boolean;
begin
  is_explicit := coalesce(new.raw_user_meta_data ? 'username', false);
  raw_username := lower(coalesce(new.raw_user_meta_data ->> 'username', split_part(coalesce(new.email, 'user'), '@', 1)));
  clean_username := regexp_replace(raw_username, '[^a-z0-9_]', '', 'g');
  if length(clean_username) < 3 then clean_username := 'user'; end if;
  clean_username := left(clean_username, 24);

  if is_explicit then
    insert into public.profiles (user_id, username) values (new.id, clean_username);
  else
    insert into public.profiles (user_id, username)
    values (new.id, left(clean_username, 17) || '_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_pennywise on auth.users;
create trigger on_auth_user_created_pennywise
after insert on auth.users
for each row execute procedure public.handle_new_pennywise_user();

-- Keep the updated_at value server-generated instead of trusting the browser.
create or replace function public.set_pennywise_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists pennywise_user_data_updated_at on public.pennywise_user_data;
create trigger pennywise_user_data_updated_at
before update on public.pennywise_user_data
for each row execute procedure public.set_pennywise_updated_at();

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.pennywise_user_data to authenticated;
revoke all on public.profiles from anon;
revoke all on public.pennywise_user_data from anon;
