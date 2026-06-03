"use server";

import { revalidatePath } from "next/cache";

import { requireOrgMembership } from "@/lib/supabase/org";

export type ActionResult = { error: string | null };

function revalidateApp(slug: string, jobId: string, appId: string) {
  revalidatePath(`/${slug}/jobs/${jobId}/applications/${appId}`);
}

export async function addNote(
  slug: string,
  jobId: string,
  appId: string,
  body: string
): Promise<ActionResult> {
  const trimmed = body.trim();
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
    feedback: feedback.trim() || null,
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
