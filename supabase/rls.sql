-- ============================================================================
-- yourATS — Row Level Security
-- Run this AFTER schema.sql in the Supabase SQL Editor.
--
-- Model: every domain row carries an org_id. A user may read/write a row only
-- if they are a member of that org (public.is_org_member). Some destructive or
-- administrative actions additionally require an elevated role
-- (public.has_org_role).
-- ============================================================================

alter table public.organizations    enable row level security;
alter table public.profiles          enable row level security;
alter table public.org_members       enable row level security;
alter table public.jobs              enable row level security;
alter table public.job_stages        enable row level security;
alter table public.candidates        enable row level security;
alter table public.applications      enable row level security;
alter table public.application_notes enable row level security;
alter table public.scorecards        enable row level security;
alter table public.org_invitations   enable row level security;

-- ----------------------------------------------------------------------------
-- profiles: a user manages only their own profile, and can read the profiles
-- of anyone they share an organization with (for member lists, note/scorecard
-- author names, avatars). SECURITY DEFINER avoids recursive RLS on org_members.
-- ----------------------------------------------------------------------------
create or replace function public.shares_org_with(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.org_members m_self
    join public.org_members m_other on m_self.org_id = m_other.org_id
    where m_self.user_id = auth.uid() and m_other.user_id = target
  );
$$;

create policy "profiles_select_member" on public.profiles
  for select using (id = auth.uid() or public.shares_org_with(id));

create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy "profiles_insert_own" on public.profiles
  for insert with check (id = auth.uid());

-- ----------------------------------------------------------------------------
-- organizations
-- ----------------------------------------------------------------------------
-- Any authenticated user may create an org (they become its first member via
-- a follow-up org_members insert in the same transaction / server action).
create policy "orgs_insert_authenticated" on public.organizations
  for insert to authenticated
  with check (created_by = auth.uid());

create policy "orgs_select_members" on public.organizations
  for select using (public.is_org_member(id));

create policy "orgs_update_admins" on public.organizations
  for update using (public.has_org_role(id, array['owner','admin']::org_role[]))
  with check (public.has_org_role(id, array['owner','admin']::org_role[]));

create policy "orgs_delete_owner" on public.organizations
  for delete using (public.has_org_role(id, array['owner']::org_role[]));

-- ----------------------------------------------------------------------------
-- org_members
-- ----------------------------------------------------------------------------
-- A user can always see their own membership rows (needed to resolve orgs),
-- and can see all members of orgs they belong to.
create policy "members_select_self_or_org" on public.org_members
  for select using (
    user_id = auth.uid() or public.is_org_member(org_id)
  );

-- Bootstrap: a user may insert their OWN membership (first owner row), or an
-- existing admin/owner may add members.
create policy "members_insert_self_or_admin" on public.org_members
  for insert with check (
    user_id = auth.uid()
    or public.has_org_role(org_id, array['owner','admin']::org_role[])
  );

create policy "members_update_admin" on public.org_members
  for update using (public.has_org_role(org_id, array['owner','admin']::org_role[]))
  with check (public.has_org_role(org_id, array['owner','admin']::org_role[]));

create policy "members_delete_admin_or_self" on public.org_members
  for delete using (
    user_id = auth.uid()
    or public.has_org_role(org_id, array['owner','admin']::org_role[])
  );

-- ----------------------------------------------------------------------------
-- Generic per-org tables: members can do everything within their org.
-- (Tighten with has_org_role later if you want read-only "viewer" roles.)
-- ----------------------------------------------------------------------------

-- jobs
create policy "jobs_all_members" on public.jobs
  for all using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

-- job_stages
create policy "job_stages_all_members" on public.job_stages
  for all using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

-- candidates
create policy "candidates_all_members" on public.candidates
  for all using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

-- applications
create policy "applications_all_members" on public.applications
  for all using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

-- application_notes
create policy "application_notes_select_members" on public.application_notes
  for select using (public.is_org_member(org_id));

create policy "application_notes_insert_author" on public.application_notes
  for insert with check (public.is_org_member(org_id) and author_id = auth.uid());

create policy "application_notes_modify_author" on public.application_notes
  for update using (author_id = auth.uid())
  with check (author_id = auth.uid());

create policy "application_notes_delete_author_or_admin" on public.application_notes
  for delete using (
    author_id = auth.uid()
    or public.has_org_role(org_id, array['owner','admin']::org_role[])
  );

-- scorecards
create policy "scorecards_select_members" on public.scorecards
  for select using (public.is_org_member(org_id));

create policy "scorecards_insert_author" on public.scorecards
  for insert with check (public.is_org_member(org_id) and author_id = auth.uid());

create policy "scorecards_modify_author" on public.scorecards
  for update using (author_id = auth.uid())
  with check (author_id = auth.uid());

create policy "scorecards_delete_author_or_admin" on public.scorecards
  for delete using (
    author_id = auth.uid()
    or public.has_org_role(org_id, array['owner','admin']::org_role[])
  );

-- ----------------------------------------------------------------------------
-- org_invitations: only owners/admins manage invites for their org.
-- Accepting an invite runs server-side with the service-role client (which
-- bypasses RLS), so invitees don't need a read policy here.
-- ----------------------------------------------------------------------------
create policy "invites_admin_all" on public.org_invitations
  for all
  using (public.has_org_role(org_id, array['owner','admin']::org_role[]))
  with check (public.has_org_role(org_id, array['owner','admin']::org_role[]));
