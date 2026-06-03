# yourATS — Roadmap: how it can serve the company further

Where the product can go next, grouped by the value it delivers. Each item notes
why it matters and roughly how it fits the existing architecture.

## Recently shipped (hardening + outcomes)
- **Outcome tracking** — applications can now be marked **Active / Hired /
  Rejected / Withdrawn**, so the pipeline reflects real results (not just stages).
- **Abuse hardening on the public apply form** — honeypot bot-trap, input length
  caps, and email validation; AI input is size-capped; notes/scorecards are
  length-capped.

## High value, low effort
- **Team invites & roles.** The `org_members` table already has an
  `owner/admin/recruiter/viewer` enum and `has_org_role` helper — wire an invite
  email (Resend is configured) + an "Add member" UI. *Why:* hiring is a team
  sport; this turns a single-user tool into a workspace.
- **Enforce read-only `viewer` role.** Today any member can edit; gate
  destructive/edit actions behind `has_org_role` in RLS + UI. *Why:* safe access
  for interviewers/hiring managers who should only comment and score.
- **Candidate email from the app.** "Reject with template", "request a call" —
  send via Resend, log it as a note. *Why:* keeps all candidate comms in one place.
- **Pipeline stage automation.** e.g. moving to "Rejected" sets status; entering
  "Offer" notifies the recruiter. *Why:* fewer manual steps, fewer dropped balls.

## Reporting & insight (manager value)
- **Hiring dashboard / funnel metrics** — applicants per stage, conversion rates,
  **time-to-hire**, source effectiveness (Careers vs. Import vs. manual),
  open-role aging. *Why:* lets leadership see hiring health and bottlenecks; the
  data already exists in `applications` (stage, status, timestamps) and
  `candidates.source`.
- **Per-recruiter activity** — notes/scorecards submitted, candidates advanced.

## Better AI (quality of ranking)
- **Real embedding-based scoring** via Hugging Face's current router API (or an
  OpenAI/own model), with the deterministic keyword score kept as fallback.
- **Explainable match** — show *which* skills/requirements matched and which are
  missing, not just a %. *Why:* recruiters trust scores they can see reasoning for.
- **JD-aware skill extraction** — extract the job's required skills and compare
  per-skill. **Duplicate/﻿similar candidate detection** across the pool.

## Candidate experience
- **OCR for scanned PDFs** so image-only résumés still parse (currently text-only).
- **Branded careers page** — org logo/colors (the `logo_url` column exists),
  custom apply questions, application status lookup for candidates.
- **Resume attachments on the public apply form** (upload straight into the
  pipeline, reusing the private bucket + signed-URL pattern).

## Scale & robustness
- **Generated DB types** via `supabase gen types` to replace the hand-written
  `types.ts` as the schema grows.
- **Audit log** of who changed what (status, stage, deletes).
- **Rate limiting** on the public apply endpoint (per-IP) beyond the honeypot.
- **Background jobs** for bulk AI scoring of large imports.
- **Tests** — unit tests for `lib/ai.ts` and RLS policy tests in CI.

## Integrations (meeting teams where they are)
- **Calendar / scheduling** for interviews (Google/Microsoft).
- **Slack notifications** on new applicants or stage changes.
- **Job-board syndication** (LinkedIn/Indeed) from a posted job.
- **HRIS handoff** when a candidate is marked Hired.

---

**Suggested next step:** team invites + the hiring funnel dashboard — together they
turn yourATS from a personal tracker into a multi-recruiter system with the
reporting leadership asks for, and both build directly on data/structures that
already exist.
