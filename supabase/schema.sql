-- Brotein user profiles.
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Passwords live in Supabase Auth (auth.users); this table holds the extra profile data.

create table if not exists public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    name text not null default 'Unknown',
    email text,
    package text not null default 'FREE' check (package in ('FREE', 'PREMIUM')),
    is_admin boolean not null default false,
    created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- True when the signed-in user is an admin. security definer so it can read
-- profiles without triggering the RLS policies below (which would recurse).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = ''
as $$
    select coalesce(
        (select is_admin from public.profiles where id = auth.uid()),
        false
    );
$$;

-- Users read their own profile; admins read everyone's. There is no update
-- policy, so nobody can change their package or admin flag from the browser.
drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Read own profile or admin reads all" on public.profiles;
create policy "Read own profile or admin reads all"
    on public.profiles for select
    using (auth.uid() = id or public.is_admin());

-- Create a profile row automatically whenever someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
    chosen_package text := upper(coalesce(new.raw_user_meta_data ->> 'package', 'FREE'));
begin
    if chosen_package not in ('FREE', 'PREMIUM') then
        chosen_package := 'FREE';
    end if;

    insert into public.profiles (id, name, email, package)
    values (
        new.id,
        coalesce(new.raw_user_meta_data ->> 'name', 'Unknown'),
        new.email,
        chosen_package
    );
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();

-- Lets admins delete an account (login and profile) from admin.html.
create or replace function public.admin_delete_user(target_id uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
    if not public.is_admin() then
        raise exception 'Only admins can remove users';
    end if;
    if target_id = auth.uid() then
        raise exception 'You cannot remove your own account here';
    end if;
    delete from auth.users where id = target_id;
end;
$$;

revoke execute on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;

-- Moves the signed-in user to PREMIUM (used by upgrade.html). There is no
-- payment check yet, matching the site's current behaviour.
create or replace function public.upgrade_to_premium()
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
    if auth.uid() is null then
        raise exception 'You must be logged in to upgrade';
    end if;
    update public.profiles set package = 'PREMIUM' where id = auth.uid();
end;
$$;

revoke execute on function public.upgrade_to_premium() from public, anon;
grant execute on function public.upgrade_to_premium() to authenticated;

-- Saved workout plans: one per user (unique user_id). To make a new plan the
-- user deletes the old one first. Only the inputs are stored; the site rebuilds
-- the full plan and PDF from them with plan-builder.js.
create table if not exists public.workout_plans (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null unique references auth.users (id) on delete cascade,
    name text not null default '',
    gender text not null check (gender in ('male', 'female')),
    weight_kg numeric not null check (weight_kg > 0),
    height_cm numeric not null check (height_cm > 0),
    age integer not null check (age >= 0),
    days integer not null check (days between 1 and 7),
    goal text not null check (goal in ('loss', 'maintain', 'gain', 'muscle')),
    created_at timestamptz not null default now()
);

alter table public.workout_plans enable row level security;

drop policy if exists "Users read own plan" on public.workout_plans;
create policy "Users read own plan"
    on public.workout_plans for select
    using (auth.uid() = user_id);

-- Generating plans is a Premium feature.
drop policy if exists "Premium users create own plan" on public.workout_plans;
create policy "Premium users create own plan"
    on public.workout_plans for insert
    with check (
        auth.uid() = user_id
        and exists (
            select 1 from public.profiles
            where id = auth.uid() and package = 'PREMIUM'
        )
    );

-- Questionnaire answers for plans built by plan-engine.js (null for older plans).
alter table public.workout_plans add column if not exists answers jsonb;

-- The questionnaire adds two goals: 'strength' and 'health'.
alter table public.workout_plans drop constraint if exists workout_plans_goal_check;
alter table public.workout_plans add constraint workout_plans_goal_check
    check (goal in ('loss', 'maintain', 'gain', 'muscle', 'strength', 'health'));

drop policy if exists "Users delete own plan" on public.workout_plans;
create policy "Users delete own plan"
    on public.workout_plans for delete
    using (auth.uid() = user_id);

-- Saved food plans: one per user (unique user_id). This mirrors the workout
-- plan storage and keeps each food plan tied to the user’s personal stats.
create table if not exists public.food_plans (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null unique references auth.users (id) on delete cascade,
    name text not null default '',
    gender text not null check (gender in ('male', 'female')),
    weight_kg numeric not null check (weight_kg > 0),
    height_cm numeric not null check (height_cm > 0),
    age integer not null check (age >= 0),
    days integer not null check (days between 1 and 7),
    goal text not null check (goal in ('loss', 'maintain', 'gain', 'muscle')),
    maintenance_calories integer not null check (maintenance_calories >= 0),
    daily_target_calories integer not null check (daily_target_calories >= 0),
    weekly_target_calories integer not null check (weekly_target_calories >= 0),
    protein_target_g integer not null check (protein_target_g >= 0),
    created_at timestamptz not null default now()
);

alter table public.food_plans enable row level security;

drop policy if exists "Users read own food plan" on public.food_plans;
create policy "Users read own food plan"
    on public.food_plans for select
    using (auth.uid() = user_id);

drop policy if exists "Premium users create own food plan" on public.food_plans;
create policy "Premium users create own food plan"
    on public.food_plans for insert
    with check (
        auth.uid() = user_id
        and exists (
            select 1 from public.profiles
            where id = auth.uid() and package = 'PREMIUM'
        )
    );

drop policy if exists "Users delete own food plan" on public.food_plans;
create policy "Users delete own food plan"
    on public.food_plans for delete
    using (auth.uid() = user_id);

-- Personal info users fill in on profile.html; used to prefill the calculators and plan form.
alter table public.profiles add column if not exists weight numeric check (weight >= 0);
alter table public.profiles add column if not exists weight_unit text not null default 'kg' check (weight_unit in ('kg', 'lbs'));
alter table public.profiles add column if not exists height numeric check (height >= 0);
alter table public.profiles add column if not exists age integer check (age >= 0 and age <= 120);
alter table public.profiles add column if not exists gender text check (gender in ('male', 'female'));

-- Users may update only these personal columns on their own row, never
-- package or is_admin (those change only through the functions above or by
-- hand in the dashboard).
revoke update on public.profiles from anon, authenticated;
grant update (weight, weight_unit, height, age, gender) on public.profiles to authenticated;

drop policy if exists "Users update own personal info" on public.profiles;
create policy "Users update own personal info"
    on public.profiles for update
    using (auth.uid() = id)
    with check (auth.uid() = id);

-- Whether the user opted in to daily gym reminder notifications (calendar.html).
alter table public.profiles add column if not exists notifications_enabled boolean not null default false;
grant update (notifications_enabled) on public.profiles to authenticated;

-- Optional overrides for which weekdays are training days (calendar.html "swap day"),
-- and per-meal reminder times. Both are arrays/objects handled entirely client-side.
alter table public.profiles add column if not exists training_day_overrides jsonb;
alter table public.profiles add column if not exists meal_reminder_times jsonb;
grant update (training_day_overrides, meal_reminder_times) on public.profiles to authenticated;

-- Daily check-ins for the calendar: workout completion, which meals were eaten, and
-- an optional bodyweight check-in. One row per user per day.
create table if not exists public.calendar_logs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    log_date date not null,
    workout_done boolean not null default false,
    meals_done text[] not null default '{}',
    weight_kg numeric check (weight_kg >= 0),
    updated_at timestamptz not null default now(),
    unique (user_id, log_date)
);

alter table public.calendar_logs enable row level security;

drop policy if exists "Users manage own calendar logs" on public.calendar_logs;
create policy "Users manage own calendar logs"
    on public.calendar_logs for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- Saved gyms from gym-finder.html. A user can favorite any number of gyms; gym_osm_id is
-- the "osm_type/osm_id" pair gym-finder.js already uses as each gym's id.
create table if not exists public.favorite_gyms (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    gym_osm_id text not null,
    name text not null,
    lat numeric not null,
    lon numeric not null,
    address text,
    created_at timestamptz not null default now(),
    unique (user_id, gym_osm_id)
);

alter table public.favorite_gyms enable row level security;

drop policy if exists "Users manage own favorite gyms" on public.favorite_gyms;
create policy "Users manage own favorite gyms"
    on public.favorite_gyms for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- To make yourself an admin, register on the site first, then run:
--   update public.profiles set is_admin = true where email = 'you@example.com';
