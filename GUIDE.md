# yourATS — User Guide

How to use the app, end to end. (For setup & deployment, see [README.md](README.md).)

## 1. Create your account & workspace

1. Go to the site and click **Get started**.
2. Sign up with your name, email, and a password (6+ characters).
   - If email confirmation is enabled, check your inbox and click the link.
3. On **onboarding**, create your **organization**: enter a name and pick a
   workspace URL slug (auto-suggested, editable, checked for availability).
4. You land on your **dashboard** at `/{your-slug}/dashboard`.

Forgot your password? Use **Forgot password?** on the sign-in page → you'll get
an email link to set a new one.

## 2. Dashboard

A quick overview of your workspace: counts for open jobs, total jobs,
candidates, and active applications, plus your most recent jobs. Use **New job**
to post a role.

## 3. Post a job

1. **Jobs → New job**.
2. Fill in title (required), department, location, employment type, status, and
   a description.
   - The **description matters for AI match scoring** — paste the real
     requirements.
3. On save, the job is created with a default pipeline:
   **Applied → Screening → Interview → Offer → Hired**.

### Editing a job & its pipeline
Open a job to:
- Edit details and change **status** (Draft / Open / Closed / Archived). Only
  **Open** jobs appear on the public careers page.
- Manage **pipeline stages**: add, rename, reorder (↑/↓), or delete stages.

## 4. The pipeline board

From a job, click **Open pipeline board**.
- Columns are your pipeline stages; cards are candidate applications.
- **Add candidate** drops a new applicant into the first stage.
- **Drag cards** between columns to move candidates through stages, or reorder
  within a column. Changes save automatically.
- Click the **↗ icon** on a card to open that application.

## 5. Application detail

Each card opens an application page with:
- **Résumé & AI** — paste the candidate's résumé text, then:
  - **Parse résumé & save** — extracts skills, contact info, and a summary onto
    the candidate.
  - **Score match** — scores the résumé against the job description (0–100) and
    saves it; the score shows as a badge on the board card and candidate list.
- **Scorecards** — leave a 1–5 star rating + written feedback. The page shows
  each teammate's scorecard and the average.
- **Notes** — freeform notes. You can delete your own notes and scorecards.

## 6. Candidates

**Candidates** (sidebar) lists everyone in your talent pool. You can:
- **Search** by name, email, or skill.
- **Sort** by Most recent, **Best match** (highest AI score), or Name.
- Click a candidate to see their profile and every job they've applied to.

## 7. Public careers page

Your open roles are published at **`/careers/{your-slug}`** — a public page
(no login). Candidates browse open jobs and apply with name, email, and phone.
Each application lands in the job's first pipeline stage with source
"Careers page", ready for you on the board.

> Tip: share `yourdomain.com/careers/{your-slug}` as your jobs page. Set a job's
> status to **Open** to list it, **Closed** to hide it.

## 8. Settings

**Settings** (sidebar) shows your organization details, your public careers URL,
and the list of workspace members and their roles.

## 9. Theme

Toggle light/dark mode with the sun/moon button (sidebar, landing, and auth
pages). It follows your system preference by default.

---

### About the AI features
AI runs through `/api/ai/*` and tries Hugging Face's free Inference API, falling
back to fast built-in logic when it's unavailable — so parsing and scoring
**always return a result**. Each result is labelled with its source
("Hugging Face" or "heuristic fallback"). Match scores are directional, not
gospel — use them to prioritize, alongside scorecards and your own judgment.
