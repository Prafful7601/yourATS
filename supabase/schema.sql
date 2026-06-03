-- ============================================================================
-- yourATS — Schema
-- Run this FIRST in the Supabase SQL Editor, then run rls.sql.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
do $$ begin
  create type org_role as enum ('owner', 'admin', 'recruiter', 'viewer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type job_status as enum ('draft', 'open', 'closed', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type application_status as enum ('active', 'hired', 'rejected', 'withdrawn');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- Helper: updated_at trigger
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ----------------------------------------------------------------------------
-- 1. organizations
-- ----------------------------------------------------------------------------
create table if not exists public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  logo_url    text,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint organizations_slug_format check (slug ~ '^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$')
);

create trigger organizations_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. profiles  (1:1 with auth.users)
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 3. org_members
-- ----------------------------------------------------------------------------
create table if not exists public.org_members (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        org_role not null default 'recruiter',
  created_at  timestamptz not null default now(),
  unique (org_id, user_id)
);

create index if not exists org_members_user_idx on public.org_members (user_id);
create index if not exists org_members_org_idx on public.org_members (org_id);

-- ----------------------------------------------------------------------------
-- Membership helper functions (SECURITY DEFINER avoids recursive RLS)
-- ----------------------------------------------------------------------------
create or replace function public.is_org_member(p_org_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.org_members
    where org_id = p_org_id and user_id = auth.uid()
  );
$$;

create or replace function public.has_org_role(p_org_id uuid, p_roles org_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.org_members
    where org_id = p_org_id and user_id = auth.uid() and role = any (p_roles)
  );
$$;

-- ----------------------------------------------------------------------------
-- 4. jobs
-- ----------------------------------------------------------------------------
create table if not exists public.jobs (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations (id) on delete cascade,
  title           text not null,
  description     text,
  location        text,
  department      text,
  employment_type text,
  status          job_status not null default 'draft',
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists jobs_org_idx on public.jobs (org_id);
create index if not exists jobs_status_idx on public.jobs (org_id, status);

create trigger jobs_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 5. job_stages  (ordered pipeline columns for a job)
-- ----------------------------------------------------------------------------
create table if not exists public.job_stages (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references public.jobs (id) on delete cascade,
  org_id      uuid not null references public.organizations (id) on delete cascade,
  name        text not null,
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists job_stages_job_idx on public.job_stages (job_id, position);

-- ----------------------------------------------------------------------------
-- 6. candidates
-- ----------------------------------------------------------------------------
create table if not exists public.candidates (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations (id) on delete cascade,
  full_name      text not null,
  email          text,
  phone          text,
  resume_url     text,
  parsed_resume  jsonb,
  skills         text[] not null default '{}',
  source         text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists candidates_org_idx on public.candidates (org_id);
create index if not exists candidates_email_idx on public.candidates (org_id, email);

create trigger candidates_updated_at
  before update on public.candidates
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 7. applications  (a candidate applied to a job; the Kanban card)
-- ----------------------------------------------------------------------------
create table if not exists public.applications (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  job_id        uuid not null references public.jobs (id) on delete cascade,
  candidate_id  uuid not null references public.candidates (id) on delete cascade,
  stage_id      uuid references public.job_stages (id) on delete set null,
  status        application_status not null default 'active',
  match_score   integer check (match_score between 0 and 100),
  position      integer not null default 0,
  applied_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (job_id, candidate_id)
);

create index if not exists applications_org_idx on public.applications (org_id);
create index if not exists applications_job_idx on public.applications (job_id);
create index if not exists applications_stage_idx on public.applications (stage_id, position);
create index if not exists applications_candidate_idx on public.applications (candidate_id);

create trigger applications_updated_at
  before update on public.applications
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 8. application_notes
-- ----------------------------------------------------------------------------
create table if not exists public.application_notes (
  id              uuid primary key default gen_random_uuid(),
  application_id  uuid not null references public.applications (id) on delete cascade,
  org_id          uuid not null references public.organizations (id) on delete cascade,
  author_id       uuid references auth.users (id) on delete set null,
  body            text not null,
  created_at      timestamptz not null default now()
);

create index if not exists application_notes_app_idx on public.application_notes (application_id, created_at);

-- ----------------------------------------------------------------------------
-- 9. scorecards
-- ----------------------------------------------------------------------------
create table if not exists public.scorecards (
  id              uuid primary key default gen_random_uuid(),
  application_id  uuid not null references public.applications (id) on delete cascade,
  org_id          uuid not null references public.organizations (id) on delete cascade,
  author_id       uuid references auth.users (id) on delete set null,
  rating          integer check (rating between 1 and 5),
  feedback        text,
  criteria        jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists scorecards_app_idx on public.scorecards (application_id);

create trigger scorecards_updated_at
  before update on public.scorecards
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Role grants
-- Supabase exposes the database to the anon / authenticated / service_role
-- roles. Tables created here need table-level privileges granted to those
-- roles; actual row visibility is still governed by the RLS policies in
-- rls.sql. service_role bypasses RLS but also requires these grants.
-- ----------------------------------------------------------------------------
