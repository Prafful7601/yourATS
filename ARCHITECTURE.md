# yourATS — Architecture & Build Deep-Dive

This document dissects the project end-to-end: the stack and *why* each piece was
chosen, how it was built, the architecture, the non-obvious decisions, and the
bugs caught along the way. For setup see [README.md](README.md); for using the
app see [GUIDE.md](GUIDE.md).

---

## 1. What yourATS is

A multi-tenant SaaS **Applicant Tracking System**. A company signs up, creates an
**organization** with a unique slug, and works inside `/{org}/…`:

- Post **jobs** with custom **pipeline stages**.
- Drag **candidates** across a **Kanban board** as applications.
- Open an **application** to upload/parse a résumé, **auto-score** it against the
  job (ATS match %), leave **notes** and **scorecards**.
- Candidates apply publicly at `/careers/{org}`.

Every org's data is strictly isolated by Postgres **Row Level Security**.

---

## 2. Tech stack — and why

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 14, App Router** | Server Components keep data-fetching on the server (no client API sprawl); Server Actions give typed mutations without hand-written endpoints; one deploy target. |
| Language | **TypeScript** | A hand-written `Database` type makes every Supabase query and mutation type-checked end-to-end. |
| Backend / DB | **Supabase** (Postgres + Auth + Storage) | One service for the database, auth, and file storage — and **RLS in Postgres** means tenant isolation is enforced by the database itself, not just app code. |
| Styling | **Tailwind v4** | Utility-first; v4's CSS-first config (`@theme`) pairs with the current shadcn. |
| Components | **shadcn/ui** (Base UI primitives) | Copy-in components we own and can restyle; no black-box dependency. |
| Drag & drop | **@dnd-kit** | Accessible, headless, supports the multi-container sortable the Kanban board needs. |
| Forms/validation | **react-hook-form + zod** | Lightweight client validation where needed. |
| AI | **Hugging Face Inference API** + deterministic fallback | Free tier; and a fallback so the feature never hard-fails. |
| Email | **Resend** (SMTP into Supabase Auth) | Lifts Supabase's tiny built-in email rate limit for confirmations/resets. |
| Files | **xlsx** (import), **pdf.js** (résumé text) | Parse spreadsheets and PDFs **client-side**, so large files never round-trip through a server action just to be read. |
| Hosting | **Vercel** | First-class Next.js hosting; auto-deploy on push. |

---

## 3. How it was built (the journey)

Built in phases, each one **build-verified** (`tsc` + `next build`) and
**runtime-verified against the live database** with throwaway scripts before
moving on.

1. **Foundation** — Next.js 14 scaffold, the 9-table schema, RLS policies, and
   typed Supabase clients (browser / server / admin).
2. **Auth & onboarding** — sign-up/sign-in, session middleware, the
   org-creation flow.
3. **Jobs & pipelines** — job CRUD and per-job pipeline stages (seeded with a
   default 5-stage pipeline).
4. **The board** — `@dnd-kit` Kanban; candidates as draggable applications.
5. **Profiles, notes & scorecards, public careers** — the public apply flow.
6. **AI layer** — `/api/ai/[action]` for résumé parsing and match scoring.
7. **Polish & deploy** — settings, docs, Vercel.

Post-MVP additions: Resend email, password reset, dark mode, Excel import,
private PDF résumé storage, a full nav sidebar, candidate delete, **automatic**
ATS scoring, and ATS-score ranking on the board.

---

## 4. Architecture

### 4.1 Multi-tenancy & routing

The org slug is the first URL segment: `/{org}/dashboard`, `/{org}/jobs`, etc.
Everything tenant-scoped lives under `src/app/[org]/`. The public careers site
lives at `src/app/careers/[org]/` and is intentionally outside the authed area.

Every page/action under `[org]` starts with one guard,
[`requireOrgMembership(slug)`](src/lib/supabase/org.ts): it resolves the user,
confirms they belong to that org (joining `org_members → organizations`), and
returns `{ supabase, user, org, role }` — or redirects to `/sign-in`. This is
the single choke point for "are you allowed in this workspace."

### 4.2 Auth & middleware

[`src/middleware.ts`](src/middleware.ts) runs on every request:

- Refreshes the Supabase session (cookie sync via `@supabase/ssr`).
- Unauthenticated + protected route → `/sign-in?redirect=…`.
- Authenticated + on an auth page → bounced into the app.
- **Authenticated but no org → forced to `/onboarding`** (it does a quick
  membership lookup to decide). The reset-password flow is allowed through
  without an org.

Three Supabase clients, by context:
- `client.ts` — browser (anon key, RLS-bound).
- `server.ts` — Server Components / Actions (anon key + cookies, RLS-bound).
- `admin.ts` — **service-role, bypasses RLS**; server-only, used deliberately for
  the public careers flow and storage (see §4.6, §4.7).

### 4.3 Data model

Nine tables, each tenant table carrying an `org_id`:

```
organizations ──< org_members >── (auth.users / profiles)
      │
      ├──< jobs ──< job_stages
      │      │
      │      └──< applications >── candidates
      │               │
      │               ├──< application_notes
      │               └──< scorecards
```

- **organizations** — name, unique `slug`, `created_by`.
- **profiles** — 1:1 with `auth.users`, auto-created by a trigger on sign-up.
- **org_members** — membership + `role` enum (owner/admin/recruiter/viewer).
- **jobs / job_stages** — postings and their ordered pipeline columns.
- **candidates** — talent pool (skills, parsed résumé JSON, résumé file path).
- **applications** — a candidate on a job at a stage (the Kanban card); holds
  `match_score`. Unique on `(job_id, candidate_id)`.
- **application_notes / scorecards** — feedback, scoped to their author.

`org_id` is **denormalized onto every child table** on purpose — it lets every
RLS policy be a single, fast membership check instead of walking joins.

### 4.4 Row Level Security — the core of tenant isolation

RLS is enabled on all nine tables. Policies are expressed through three
`SECURITY DEFINER` helper functions (definer = they bypass RLS *inside* the
function, which avoids infinite recursion when a policy needs to read
`org_members`):

- `is_org_member(org_id)` — are you in this org?
- `has_org_role(org_id, roles[])` — do you hold one of these roles? (used for
  destructive/admin actions like deleting an org).
- `shares_org_with(user_id)` — do you and this user share any org? (lets
  teammates see each other's profile names/avatars without exposing all users).

Domain tables use "members can do everything in their org"; notes and scorecards
additionally pin writes to `author_id = auth.uid()` so you can't post or delete
as someone else. All verified: an outsider reading another org's rows gets an
empty result, and spoofing an author is rejected (`42501`).

### 4.5 Server Actions vs. API routes

Mutations are **Server Actions** (`actions.ts` files) — they run on the server,
already have the session via cookies, validate membership through
`requireOrgMembership`, and `revalidatePath` the affected pages. No hand-written
CRUD endpoints. The **one** route handler is `/api/ai/[action]` (§4.8), because
the client needs to call AI on demand and stream a JSON result back.

### 4.6 The public careers flow (a deliberate service-role choice)

The careers pages and the apply form are **unauthenticated**. Two ways to support
that:

1. Open RLS so `anon` can read open jobs and insert candidates/applications.
2. Keep RLS fully closed to `anon`, and do the public read/write **server-side
   with the service-role client**, with strict validation.

We chose **#2**. [`applyToJob`](src/app/careers/[org]/[jobId]/actions.ts) runs as
service-role but validates every input: the org must exist, the job must belong
to it **and be `open`**, and a client-supplied `org_id` is never trusted. This
keeps the anonymous attack surface to exactly the queries we control, and
verification confirmed `anon` cannot touch tenant tables directly.

### 4.7 File storage (private bucket, no storage RLS)

Résumés live in a **private** Supabase Storage bucket (`resumes`). Rather than
write storage RLS policies, **all** access goes through membership-checked server
actions using the admin client:

- **Upload**: `uploadResume` / `uploadCandidateResume` validate membership + file
  type/size, then upload under `…/{org_id}/{candidateId}/…`.
- **View**: pages generate a short-lived **signed URL** at render time.

Verified the bucket is genuinely private — the public URL returns 400 and a
member can't download directly; everything flows through the signed URL. This
means **zero storage-policy surface** to get wrong.

### 4.8 The AI layer

All AI is behind `POST /api/ai/<action>` (`parse-resume`, `extract-skills`,
`match-score`), gated to authenticated users. The logic lives in
[`src/lib/ai.ts`](src/lib/ai.ts) and is built **fallback-first**:

- **parse-resume** → regex for email/phone + a curated skill dictionary, with an
  optional HF summarization model for the summary.
- **match-score** → tries HF sentence-embedding similarity; falls back to
  keyword-overlap between résumé and job description.

Every response carries `source: "ai" | "fallback"`. **Why:** the free HF
endpoint is flaky (and has since been restructured), so the deterministic path is
the source of truth and HF is an enhancement — the feature *always* returns a
sane, differentiated score. Verified: a matching résumé scores far higher than an
unrelated one.

**Automatic scoring:** uploading/parsing a résumé on an application now also
scores it against that job in one pass, so the board's **"Rank by ATS score"**
view and the candidates **"Best match"** sort populate hands-free.

### 4.9 The Kanban board

[`board.tsx`](src/app/[org]/jobs/[jobId]/board/board.tsx) is a `@dnd-kit`
multi-container sortable: columns are stages, cards are applications. `onDragOver`
moves a card between columns in local state; `onDragEnd` persists the destination
column's order via `moveApplication` (updates `stage_id` + reindexes positions).
It's **optimistic** — the card moves instantly; on error it toasts and
`router.refresh()`-resyncs, and after a successful move the server's revalidation
re-feeds fresh props. A **Rank by ATS score** toggle re-sorts each column by
`match_score` (drag disabled in that mode, since order becomes score-driven).

### 4.10 Spreadsheet & PDF parsing

- **Excel/CSV import** parses **client-side** with `xlsx`, matches columns by
  fuzzy header (Name/Email/Phone/Skills), then bulk-inserts via `importCandidates`
  (deduped by email).
- **PDF résumés** extract text **client-side** with `pdf.js`, which feeds the AI
  parse/score. Doing both in the browser keeps big binaries out of server actions.

---

## 5. Notable decisions & bugs caught (the interesting "why"s)

- **Tailwind v3 → v4 migration.** The scaffold installed Tailwind v3, but the
  current shadcn CLI generates **v4 + Base UI** components. Rather than fight it
  back to v3+Radix, the project was migrated to v4 (CSS-first `@theme`, oklch
  tokens) to match the generated components.
- **The RLS bootstrap bug.** The classic `insert(org).select()` pattern *fails*
  here: at org-creation time the user isn't a member yet, so the `SELECT` policy
  hides the row the `RETURNING` clause tries to read, and the whole insert errors.
  Fix: **generate the org `id` client-side and skip `RETURNING`**, then insert the
  owner membership. Same pattern made the careers apply flow robust.
- **Missing table grants.** New tables weren't granted to the `anon` /
  `authenticated` / `service_role` roles, so even the service role got `42501`.
  Added explicit `GRANT`s in `schema.sql` (RLS still does the row-level gating).
- **Co-member profile visibility.** Profiles were self-only readable, so member
  lists and note authors showed blank. Added `shares_org_with` + a policy so
  teammates resolve each other's names without exposing the whole user table.
- **Service-role for public + storage** (§4.6, §4.7) — chosen specifically to
  avoid widening anonymous RLS.
- **Auth `id` generated client-side / no `RETURNING`** during bootstrap — see
  above; a recurring theme of working *with* RLS rather than around it.

---

## 6. Project structure

```
src/
  app/
    (auth)/            sign-in, sign-up, reset/update password (shared card layout)
    auth/callback/     OAuth/email code exchange
    onboarding/        org creation
    [org]/             authed workspace
      dashboard/       stats overview
      jobs/            list, new, [jobId] (detail + stage manager),
                       [jobId]/board (Kanban), [jobId]/applications/[appId]
      candidates/      list (search/sort), [candidateId] (profile + résumé)
      settings/        org + members
      layout.tsx       sidebar shell (feeds jobs to the nav)
    careers/[org]/     public careers + apply
    api/ai/[action]/   AI route
  components/          ui/ (shadcn), org-sidebar, page-header, theme-*
  lib/
    supabase/          client, server, admin, middleware, org, types
    ai.ts              AI helpers + fallbacks
    jobs.ts, slug.ts   constants/helpers
supabase/
  schema.sql           tables, enums, triggers, grants
  rls.sql              RLS policies + helper functions
samples/               sample import sheets
```

---

## 7. Security posture (summary)

- Tenant isolation enforced in **Postgres (RLS)**, not just app code.
- Service-role key is **server-only**, used for narrowly-validated public/storage
  paths; never shipped to the client.
- Résumé bucket is **private**; access only via signed URLs after a membership
  check.
- Notes/scorecards are **author-scoped**; org-admin actions gated by role.
- Public apply validates org + open-job server-side; never trusts client `org_id`.

---

## 8. Deferred / future

- True HF model scoring via the current router API (fallback stays as backup).
- OCR for image-only (scanned) PDFs.
- Team invites (the `org_members` + role model already supports it).
- Per-stage automation, email notifications to candidates, analytics.
