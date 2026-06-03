"use server";

import { revalidatePath } from "next/cache";

import { requireOrgMembership } from "@/lib/supabase/org";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

import type { ApplicationStatus } from "@/lib/supabase/types";

export type ActionResult = { error: string | null };

const APP_STATUSES: ApplicationStatus[] = [
  "active",
  "hired",
  "rejected",
  "withdrawn",
];

export async function updateApplicationStatus(
  slug: string,
  jobId: string,
  appId: string,
  status: ApplicationStatus
): Promise<ActionResult> {
  if (!APP_STATUSES.includes(status)) return { error: "Invalid status." };
  const { supabase } = await requireOrgMembership(slug);
  const { error } = await supabase
    .from("applications")
    .update({ status })
    .eq("id", appId);
  if (error) return { error: error.message };
  revalidateApp(slug, jobId, appId);
  revalidatePath(`/${slug}/jobs/${jobId}/board`);
  return { error: null };
}

function revalidateApp(slug: string, jobId: string, appId: string) {
  revalidatePath(`/${slug}/jobs/${jobId}/applications/${appId}`);
}

export async function addNote(
  slug: string,
  jobId: string,
  appId: string,
  body: string
): Promise<ActionResult> {
  const trimmed = body.trim().slice(0, 5000);
  if (!trimmed) return { error: "Note cannot be empty." };

  const { supabase, org, user } = await requireOrgMembership(slug);
  const { error } = await supabase.from("application_notes").insert({
    application_id: appId,
    org_id: org.id,
    author_id: user.id,
    body: trimmed,
  });
  if (error) return { error: error.message };

  revalidateApp(slug, jobId, appId);
  return { error: null };
}

export async function deleteNote(
  slug: string,
  jobId: string,
  appId: string,
  noteId: string
): Promise<ActionResult> {
  const { supabase } = await requireOrgMembership(slug);
  const { error } = await supabase
    .from("application_notes")
    .delete()
    .eq("id", noteId);
  if (error) return { error: error.message };

  revalidateApp(slug, jobId, appId);
  return { error: null };
}

export async function addScorecard(
  slug: string,
  jobId: string,
  appId: string,
  rating: number,
  feedback: string
): Promise<ActionResult> {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { error: "Rating must be between 1 and 5." };
  }

  const { supabase, org, user } = await requireOrgMembership(slug);
  const { error } = await supabase.from("scorecards").insert({
    application_id: appId,
    org_id: org.id,
    author_id: user.id,
    rating,
    feedback: feedback.trim().slice(0, 5000) || null,
  });
  if (error) return { error: error.message };

  revalidateApp(slug, jobId, appId);
  return { error: null };
}

export async function deleteScorecard(
  slug: string,
  jobId: string,
  appId: string,
  scorecardId: string
): Promise<ActionResult> {
  const { supabase } = await requireOrgMembership(slug);
  const { error } = await supabase
    .from("scorecards")
    .delete()
    .eq("id", scorecardId);
  if (error) return { error: error.message };

  revalidateApp(slug, jobId, appId);
  return { error: null };
}

// --- AI result persistence ---------------------------------------------------

export async function saveResumeParse(
  slug: string,
  jobId: string,
  appId: string,
  candidateId: string,
  skills: string[],
  parsed: { summary: string; email: string | null; phone: string | null; raw: string }
): Promise<ActionResult> {
  const { supabase } = await requireOrgMembership(slug);

  // Merge AI-found contact info without clobbering existing values.
  const patch: Database["public"]["Tables"]["candidates"]["Update"] = {
    skills,
    parsed_resume: { ...parsed, parsed_at: new Date().toISOString() },
  };
  if (parsed.email) patch.email = parsed.email;
  if (parsed.phone) patch.phone = parsed.phone;

  const { error } = await supabase
    .from("candidates")
    .update(patch)
    .eq("id", candidateId);
  if (error) return { error: error.message };

  revalidateApp(slug, jobId, appId);
  return { error: null };
}

export async function uploadResume(
  slug: string,
  jobId: string,
  appId: string,
  candidateId: string,
  formData: FormData
): Promise<ActionResult> {
  const { supabase, org } = await requireOrgMembership(slug);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "No file provided." };
  }
  if (file.type !== "application/pdf") {
    return { error: "Only PDF résumés are supported." };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { error: "File is too large (max 10MB)." };
  }

  // Upload via the service-role client (bucket is private; membership already
  // verified above). Path is namespaced by org for isolation.
  const admin = createAdminClient();
  const path = `${org.id}/${candidateId}/${Date.now()}-${file.name.replace(
    /[^a-zA-Z0-9._-]/g,
    "_"
  )}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await admin.storage
    .from("resumes")
    .upload(path, buffer, { contentType: "application/pdf", upsert: true });
  if (upErr) return { error: upErr.message };

  const { error } = await supabase
    .from("candidates")
    .update({ resume_url: path })
    .eq("id", candidateId);
  if (error) return { error: error.message };

  revalidateApp(slug, jobId, appId);
  return { error: null };
}

export async function saveMatchScore(
  slug: string,
  jobId: string,
  appId: string,
  score: number
): Promise<ActionResult> {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const { supabase } = await requireOrgMembership(slug);
  const { error } = await supabase
    .from("applications")
    .update({ match_score: clamped })
    .eq("id", appId);
  if (error) return { error: error.message };

  revalidateApp(slug, jobId, appId);
  return { error: null };
}
