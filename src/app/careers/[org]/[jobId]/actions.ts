"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export type ApplyState = { error: string | null; ok?: boolean };

/**
 * Public, unauthenticated job application.
 *
 * Runs with the service-role client (the careers site has no logged-in user),
 * so every input is validated: the job must exist, belong to the org named by
 * `slug`, and be OPEN. We never trust the org_id from the client.
 */
export async function applyToJob(
  _prev: ApplyState,
  formData: FormData
): Promise<ApplyState> {
  const slug = String(formData.get("slug") ?? "");
  const jobId = String(formData.get("jobId") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;

  if (!fullName) return { error: "Please enter your name." };

  const admin = createAdminClient();

  // Validate the org + job, and confirm the job is open.
  const { data: org } = await admin
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (!org) return { error: "This careers page is unavailable." };

  const { data: job } = await admin
    .from("jobs")
    .select("id, status")
    .eq("id", jobId)
    .eq("org_id", org.id)
    .maybeSingle();
  if (!job || job.status !== "open") {
    return { error: "This role is no longer accepting applications." };
  }

  const { data: firstStage } = await admin
    .from("job_stages")
    .select("id")
    .eq("job_id", job.id)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!firstStage) {
    return { error: "This role isn't ready to accept applications yet." };
  }

  // Reuse an existing candidate (by email) within the org, else create.
  let candidateId: string | null = null;
  if (email) {
    const { data: existing } = await admin
      .from("candidates")
      .select("id")
      .eq("org_id", org.id)
      .eq("email", email)
      .maybeSingle();
    candidateId = existing?.id ?? null;
  }

  if (!candidateId) {
    const { data: candidate, error: cErr } = await admin
      .from("candidates")
      .insert({
        org_id: org.id,
        full_name: fullName,
        email,
        phone,
        source: "Careers page",
      })
      .select("id")
      .single();
    if (cErr || !candidate) {
      return { error: "Something went wrong. Please try again." };
    }
    candidateId = candidate.id;
  }

  const { count } = await admin
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("stage_id", firstStage.id);

  const { error: aErr } = await admin.from("applications").insert({
    org_id: org.id,
    job_id: job.id,
    candidate_id: candidateId,
    stage_id: firstStage.id,
    position: count ?? 0,
    status: "active",
  });

  if (aErr) {
    if (aErr.code === "23505") {
      return { error: "You've already applied to this role." };
    }
    return { error: "Something went wrong. Please try again." };
  }

  return { error: null, ok: true };
}
