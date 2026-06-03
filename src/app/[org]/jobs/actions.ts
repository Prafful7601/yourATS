"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireOrgMembership } from "@/lib/supabase/org";
import { DEFAULT_STAGES } from "@/lib/jobs";
import type { JobStatus } from "@/lib/supabase/types";

export type JobFormState = { error: string | null };

const VALID_STATUSES: JobStatus[] = ["draft", "open", "closed", "archived"];

function readJobFields(formData: FormData) {
  const status = String(formData.get("status") ?? "draft") as JobStatus;
  return {
    title: String(formData.get("title") ?? "").trim(),
    department: String(formData.get("department") ?? "").trim() || null,
    location: String(formData.get("location") ?? "").trim() || null,
    employment_type:
      String(formData.get("employment_type") ?? "").trim() || null,
    description: String(formData.get("description") ?? "").trim() || null,
    status: VALID_STATUSES.includes(status) ? status : "draft",
  };
}

export async function createJob(
  _prev: JobFormState,
  formData: FormData
): Promise<JobFormState> {
  const slug = String(formData.get("slug") ?? "");
  const { supabase, org, user } = await requireOrgMembership(slug);
  const fields = readJobFields(formData);

  if (!fields.title) return { error: "Job title is required." };

  const { data: job, error } = await supabase
    .from("jobs")
    .insert({ ...fields, org_id: org.id, created_by: user.id })
    .select("id")
    .single();

  if (error || !job) {
    return { error: error?.message ?? "Could not create the job." };
  }

  // Seed the default pipeline stages for this job.
  const stages = DEFAULT_STAGES.map((name, i) => ({
    org_id: org.id,
    job_id: job.id,
    name,
    position: i,
  }));
  const { error: stageError } = await supabase.from("job_stages").insert(stages);
  if (stageError) {
    // Don't strand the user — the job exists; surface the stage issue.
    return { error: `Job created, but stages failed: ${stageError.message}` };
  }

  revalidatePath(`/${slug}/jobs`);
  redirect(`/${slug}/jobs/${job.id}`);
}

export async function updateJob(
  _prev: JobFormState,
  formData: FormData
): Promise<JobFormState> {
  const slug = String(formData.get("slug") ?? "");
  const jobId = String(formData.get("jobId") ?? "");
  const { supabase } = await requireOrgMembership(slug);
  const fields = readJobFields(formData);

  if (!fields.title) return { error: "Job title is required." };

  const { error } = await supabase
    .from("jobs")
    .update(fields)
    .eq("id", jobId);

  if (error) return { error: error.message };

  revalidatePath(`/${slug}/jobs/${jobId}`);
  revalidatePath(`/${slug}/jobs`);
  return { error: null };
}

export async function deleteJob(slug: string, jobId: string) {
  const { supabase } = await requireOrgMembership(slug);
  await supabase.from("jobs").delete().eq("id", jobId);
  revalidatePath(`/${slug}/jobs`);
  redirect(`/${slug}/jobs`);
}

export async function addStage(slug: string, jobId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Stage name is required." };
  const { supabase, org } = await requireOrgMembership(slug);

  const { data: last } = await supabase
    .from("job_stages")
    .select("position")
    .eq("job_id", jobId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const position = (last?.position ?? -1) + 1;
  const { error } = await supabase
    .from("job_stages")
    .insert({ org_id: org.id, job_id: jobId, name: trimmed, position });

  if (error) return { error: error.message };
  revalidatePath(`/${slug}/jobs/${jobId}`);
  return { error: null };
}

export async function renameStage(slug: string, stageId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Stage name is required." };
  const { supabase } = await requireOrgMembership(slug);
  const { error } = await supabase
    .from("job_stages")
    .update({ name: trimmed })
    .eq("id", stageId);
  if (error) return { error: error.message };
  revalidatePath(`/${slug}/jobs`);
  return { error: null };
}

export async function deleteStage(slug: string, stageId: string) {
  const { supabase } = await requireOrgMembership(slug);
  const { error } = await supabase
    .from("job_stages")
    .delete()
    .eq("id", stageId);
  if (error) return { error: error.message };
  revalidatePath(`/${slug}/jobs`);
  return { error: null };
}

/** Swaps a stage's position with its neighbour in the given direction. */
export async function moveStage(
  slug: string,
  jobId: string,
  stageId: string,
  direction: "up" | "down"
) {
  const { supabase } = await requireOrgMembership(slug);

  const { data: stages } = await supabase
    .from("job_stages")
    .select("id, position")
    .eq("job_id", jobId)
    .order("position", { ascending: true });

  if (!stages) return { error: "Could not load stages." };

  const index = stages.findIndex((s) => s.id === stageId);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || swapWith < 0 || swapWith >= stages.length) {
    return { error: null }; // already at an edge — no-op
  }

  const a = stages[index];
  const b = stages[swapWith];
  // Swap positions for the two affected rows.
  await supabase.from("job_stages").update({ position: b.position }).eq("id", a.id);
  await supabase.from("job_stages").update({ position: a.position }).eq("id", b.id);

  revalidatePath(`/${slug}/jobs/${jobId}`);
  return { error: null };
}
