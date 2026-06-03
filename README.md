# yourATS

A multi-tenant SaaS **Applicant Tracking System**. Companies sign up, create an
organization with a unique slug, and manage hiring at `yourats.com/[org]/…` —
job postings with custom pipeline stages, a drag-and-drop candidate Kanban
board, candidate profiles, notes, scorecards, and AI-assisted resume parsing and
match scoring. Candidates apply publicly at `yourats.com/careers/[org]`.

## Stack

- **Next.js 14** (App Router, Server Actions) · **TypeScript**
- **Supabase** — Postgres, Auth, Row Level Security
- **Tailwind v4** + **shadcn/ui** (Base UI)
- **@dnd-kit** — Kanban drag-and-drop
- **Hugging Face** free Inference API — resume parsing & match scoring (with
  deterministic fallbacks)

## Data model

`organizations · profiles · org_members · jobs · job_stages · candidates ·
applications · application_notes · scorecards` — every tenant table carries an
`org_id` and is isolated by RLS. Membership/role checks run through the
`is_org_member`, `has_org_role`, and `shares_org_with` SQL helpers.

## Local setup

1. **Install**
   ```bash
   npm install
   ```
2. **Create a Supabase project**, then copy `.env.example` to `.env.local` and
   fill in:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...          # server only — never exposed
   HUGGINGFACE_API_KEY=hf_...             # optional; features fall back without it
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```
3. **Database** — in the Supabase SQL Editor, run in order:
   1. `supabase/schema.sql` (tables, enums, triggers, grants)
   2. `supabase/rls.sql` (Row Level Security policies)
4. **Auth** — in Authentication → URL Configuration, set the Site URL to your
   app URL and add `<app-url>/**` to the redirect allowlist. (For quick local
   testing you can disable "Confirm email".)
5. **Run**
   ```bash
   npm run dev
   ```

## How auth & tenancy work

- `middleware.ts` refreshes the session, protects `/[org]/*`, and routes signed-in
  users without an org to `/onboarding`.
- The public careers pages and the apply action run server-side with the
  service-role client and strict validation, so RLS for tenant data stays fully
  closed to anonymous users.

## AI features

All AI runs through `POST /api/ai/<action>` (`parse-resume`, `extract-skills`,
`match-score`), gated to authenticated users. Each action attempts Hugging Face
and falls back to deterministic logic (regex/dictionary extraction, keyword
overlap) so the product works with or without an HF key. Responses include a
`source` field (`ai` | `fallback`).

## Deploy to Vercel

1. Push to GitHub (already wired to `origin`).
2. Import the repo at [vercel.com/new](https://vercel.com/new).
3. Add the same environment variables from `.env.local` in the Vercel project
   settings (set `NEXT_PUBLIC_APP_URL` to your production URL).
4. In Supabase Auth, add your Vercel domain to the redirect allowlist.
5. Deploy.

## Scripts

```bash
npm run dev     # local dev server
npm run build   # production build
npm run start   # serve the production build
npm run lint    # eslint
```
