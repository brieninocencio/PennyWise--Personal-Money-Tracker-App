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
  revision bigint not null default 0,
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

-- Save a snapshot only when it is based on the latest known revision. This
-- prevents a stale browser from silently replacing edits from another device.
create or replace function public.save_pennywise_snapshot(
  p_payload jsonb,
  p_expected_revision bigint default null
)
returns table(status text, revision bigint, payload jsonb)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  saved_revision bigint;
  current_revision bigint;
  current_payload jsonb;
begin
  if current_user_id is null then raise exception 'Authentication is required'; end if;
  if jsonb_typeof(p_payload) <> 'object' then raise exception 'PennyWise payload must be a JSON object'; end if;

  if p_expected_revision is not null then
    update public.pennywise_user_data set payload = p_payload, revision = revision + 1
      where user_id = current_user_id and revision = p_expected_revision
      returning revision into saved_revision;
    if found then return query select 'saved'::text, saved_revision, p_payload; return; end if;
  else
    insert into public.pennywise_user_data (user_id, payload, revision)
      values (current_user_id, p_payload, 1)
      on conflict (user_id) do nothing
      returning revision into saved_revision;
    if found then return query select 'saved'::text, saved_revision, p_payload; return; end if;
  end if;

  select d.revision, d.payload into current_revision, current_payload
    from public.pennywise_user_data d where d.user_id = current_user_id;
  return query select 'conflict'::text, current_revision, current_payload;
end;
$$;

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.pennywise_user_data to authenticated;
revoke all on public.profiles from anon;
revoke all on public.pennywise_user_data from anon;
revoke all on function public.handle_new_pennywise_user() from public, anon, authenticated;
revoke all on function public.save_pennywise_snapshot(jsonb, bigint) from public, anon;
grant execute on function public.save_pennywise_snapshot(jsonb, bigint) to authenticated;
