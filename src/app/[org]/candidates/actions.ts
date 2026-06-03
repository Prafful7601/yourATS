"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireOrgMembership } from "@/lib/supabase/org";
import { createAdminClient } from "@/lib/supabase/admin";

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
