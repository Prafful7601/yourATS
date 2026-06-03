"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireOrgMembership } from "@/lib/supabase/org";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

export type NewCandidateState = { error: string | null };

/** Creates a single candidate in the org pool, then opens their profile. */
export async function createCandidate(
  _prev: NewCandidateState,
  formData: FormData
): Promise<NewCandidateState> {
  const slug = String(formData.get("slug") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;

  if (!fullName) return { error: "Candidate name is required." };

  const { supabase, org } = await requireOrgMembership(slug);

  // Reuse an existing candidate with the same email instead of duplicating.
  if (email) {
    const { data: existing } = await supabase
      .from("candidates")
      .select("id")
      .eq("org_id", org.id)
      .eq("email", email)
      .maybeSingle();
    if (existing) {
      revalidatePath(`/${slug}/candidates`);
      redirect(`/${slug}/candidates/${existing.id}`);
    }
  }

  const { data: candidate, error } = await supabase
    .from("candidates")
    .insert({ org_id: org.id, full_name: fullName, email, phone })
    .select("id")
    .single();
  if (error || !candidate) {
    return { error: error?.message ?? "Could not create candidate." };
  }

  revalidatePath(`/${slug}/candidates`);
  redirect(`/${slug}/candidates/${candidate.id}`);
}

/** Uploads a candidate's résumé PDF (no job context) and stores the path. */
export async function uploadCandidateResume(
  slug: string,
  candidateId: string,
  formData: FormData
): Promise<{ error: string | null }> {
  const { supabase, org } = await requireOrgMembership(slug);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "No file provided." };
  if (file.type !== "application/pdf") return { error: "Only PDF résumés are supported." };
  if (file.size > 10 * 1024 * 1024) return { error: "File is too large (max 10MB)." };

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

  revalidatePath(`/${slug}/candidates/${candidateId}`);
  return { error: null };
}

/** Saves parsed résumé skills/summary onto a candidate (org-level, no job). */
export async function saveCandidateParse(
  slug: string,
  candidateId: string,
  skills: string[],
  parsed: { summary: string; email: string | null; phone: string | null; raw: string }
): Promise<{ error: string | null }> {
  const { supabase } = await requireOrgMembership(slug);
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

  revalidatePath(`/${slug}/candidates/${candidateId}`);
  return { error: null };
}

/** Deletes a candidate (cascades applications, notes, scorecards) and their résumé file. */
export async function deleteCandidate(slug: string, candidateId: string) {
  const { supabase } = await requireOrgMembership(slug);

  const { data: cand } = await supabase
    .from("candidates")
    .select("resume_url")
    .eq("id", candidateId)
    .maybeSingle();

  const { error } = await supabase
    .from("candidates")
    .delete()
    .eq("id", candidateId);
  if (error) return { error: error.message };

  // Best-effort: remove the stored résumé from the private bucket.
  if (cand?.resume_url) {
    try {
      await createAdminClient().storage.from("resumes").remove([cand.resume_url]);
    } catch {
      // ignore — the DB row is already gone
    }
  }

  revalidatePath(`/${slug}/candidates`);
  redirect(`/${slug}/candidates`);
}

/** Bulk-deletes candidates (cascades their apps/notes/scorecards + résumé files). */
export async function deleteCandidates(
  slug: string,
  ids: string[]
): Promise<{ error: string | null; deleted?: number }> {
  if (!ids.length) return { error: null, deleted: 0 };
  const { supabase } = await requireOrgMembership(slug);

  const { data: cands } = await supabase
    .from("candidates")
    .select("resume_url")
    .in("id", ids);

  const { error, count } = await supabase
    .from("candidates")
    .delete({ count: "exact" })
    .in("id", ids);
  if (error) return { error: error.message };

  const paths = (cands ?? [])
    .map((c) => c.resume_url)
    .filter((p): p is string => Boolean(p));
  if (paths.length) {
    try {
      await createAdminClient().storage.from("resumes").remove(paths);
    } catch {
      // ignore — rows already deleted
    }
  }

  revalidatePath(`/${slug}/candidates`);
  return { error: null, deleted: count ?? ids.length };
}

export type ImportRow = {
  full_name: string;
  email?: string | null;
  phone?: string | null;
  skills?: string[];
};

export type ImportResult = {
  error: string | null;
  inserted?: number;
  skipped?: number;
};

/** Bulk-imports candidates into the org's talent pool, deduped by email. */
export async function importCandidates(
  slug: string,
  rows: ImportRow[]
): Promise<ImportResult> {
  const { supabase, org } = await requireOrgMembership(slug);

  // Sanitize: must have a name; trim everything.
  const clean = rows
    .map((r) => ({
      full_name: String(r.full_name ?? "").trim(),
      email: r.email ? String(r.email).trim().toLowerCase() : null,
      phone: r.phone ? String(r.phone).trim() : null,
      skills: Array.isArray(r.skills)
        ? r.skills.map((s) => String(s).trim()).filter(Boolean)
        : [],
    }))
    .filter((r) => r.full_name);

  if (clean.length === 0) {
    return { error: "No valid rows found. Each row needs at least a name." };
  }
  if (clean.length > 1000) {
    return { error: "Please import 1000 rows or fewer at a time." };
  }

  // Skip emails that already exist in the org.
  const emails = clean.map((r) => r.email).filter((e): e is string => Boolean(e));
  const existing = new Set<string>();
  if (emails.length > 0) {
    const { data } = await supabase
      .from("candidates")
      .select("email")
      .eq("org_id", org.id)
      .in("email", emails);
    data?.forEach((c) => c.email && existing.add(c.email.toLowerCase()));
  }

  // Also dedupe within the file itself.
  const seen = new Set<string>();
  const toInsert = clean.filter((r) => {
    if (!r.email) return true;
    if (existing.has(r.email) || seen.has(r.email)) return false;
    seen.add(r.email);
    return true;
  });

  const skipped = clean.length - toInsert.length;
  if (toInsert.length === 0) {
    return { error: null, inserted: 0, skipped };
  }

  const { error, count } = await supabase
    .from("candidates")
    .insert(
      toInsert.map((r) => ({
        org_id: org.id,
        full_name: r.full_name,
        email: r.email,
        phone: r.phone,
        skills: r.skills,
        source: "Import",
      })),
      { count: "exact" }
    );

  if (error) return { error: error.message };

  revalidatePath(`/${slug}/candidates`);
  return { error: null, inserted: count ?? toInsert.length, skipped };
}
