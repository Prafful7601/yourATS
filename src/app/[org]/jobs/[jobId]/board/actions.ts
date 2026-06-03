"use server";

import { revalidatePath } from "next/cache";

import { requireOrgMembership } from "@/lib/supabase/org";

export type AddCandidateState = { error: string | null; ok?: boolean };

export async function addCandidateToJob(
  _prev: AddCandidateState,
  formData: FormData
): Promise<AddCandidateState> {
  const slug = String(formData.get("slug") ?? "");
  const jobId = String(formData.get("jobId") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;

  if (!fullName) return { error: "Candidate name is required." };

  const { supabase, org } = await requireOrgMembership(slug);

  // Land new applications in the first pipeline stage.
  const { data: firstStage } = await supabase
    .from("job_stages")
    .select("id")
    .eq("job_id", jobId)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!firstStage) {
    return { error: "This job has no pipeline stages yet." };
  }

  // Reuse an existing candidate with the same email in this org, else create.
  let candidateId: string | null = null;
  if (email) {
    const { data: existing } = await supabase
      .from("candidates")
      .select("id")
      .eq("org_id", org.id)
      .eq("email", email)
      .maybeSingle();
    candidateId = existing?.id ?? null;
  }

  if (!candidateId) {
    const { data: candidate, error: cErr } = await supabase
      .from("candidates")
      .insert({ org_id: org.id, full_name: fullName, email, phone })
      .select("id")
      .single();
    if (cErr || !candidate) {
      return { error: cErr?.message ?? "Could not create candidate." };
    }
    candidateId = candidate.id;
  }

  // Position the new card at the bottom of the first stage.
  const { count } = await supabase
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("stage_id", firstStage.id);

  const { error: aErr } = await supabase.from("applications").insert({
    org_id: org.id,
    job_id: jobId,
    candidate_id: candidateId,
    stage_id: firstStage.id,
    position: count ?? 0,
    status: "active",
  });

  if (aErr) {
    // 23505 = unique (job_id, candidate_id): already applied to this job.
    if (aErr.code === "23505") {
      return { error: `${fullName} has already been added to this job.` };
    }
    return { error: aErr.message };
  }

  revalidatePath(`/${slug}/jobs/${jobId}/board`);
  return { error: null, ok: true };
}

/**
 * Persists a drag: moves an application to `toStageId` and rewrites the
 * positions of every card in that destination column to match `orderedIds`.
 */
export async function moveApplication(
  slug: string,
  jobId: string,
  applicationId: string,
  toStageId: string,
  orderedIds: string[]
): Promise<{ error: string | null }> {
  const { supabase } = await requireOrgMembership(slug);

  const { error } = await supabase
    .from("applications")
    .update({ stage_id: toStageId })
    .eq("id", applicationId);
  if (error) return { error: error.message };

  // Reindex the destination column.
  await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from("applications").update({ position: index }).eq("id", id)
    )
  );

  revalidatePath(`/${slug}/jobs/${jobId}/board`);
  return { error: null };
}
