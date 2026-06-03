"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SLUG_RE, slugify } from "@/lib/slug";

export type CreateOrgState = { error: string | null };

/**
 * Checks slug availability across ALL orgs. Must use the admin client because
 * RLS hides organizations the current user is not a member of, which would
 * make a normal query report taken slugs as available.
 */
export async function checkSlugAvailability(
  slug: string
): Promise<{ available: boolean }> {
  const normalized = slugify(slug);
  if (!SLUG_RE.test(normalized)) return { available: false };

  const admin = createAdminClient();
  const { count } = await admin
    .from("organizations")
    .select("id", { count: "exact", head: true })
    .eq("slug", normalized);

  return { available: (count ?? 0) === 0 };
}

export async function createOrganization(
  _prev: CreateOrgState,
  formData: FormData
): Promise<CreateOrgState> {
  const name = String(formData.get("name") ?? "").trim();
  const slug = slugify(String(formData.get("slug") ?? ""));

  if (!name) return { error: "Organization name is required." };
  if (!SLUG_RE.test(slug)) {
    return {
      error:
        "Slug must be lowercase letters, numbers, and hyphens (no leading or trailing hyphen).",
    };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // Authoritative uniqueness check (bypasses RLS).
  const { available } = await checkSlugAvailability(slug);
  if (!available) {
    return { error: `The slug "${slug}" is already taken.` };
  }

  // 1) Create the organization (RLS requires created_by === auth.uid()).
  // We generate the id ourselves and skip RETURNING: at this point the user is
  // not yet a member, so the SELECT policy would hide the new row and a
  // `.select()` here would fail. The membership insert below fixes that.
  const orgId = crypto.randomUUID();
  const { error: orgError } = await supabase
    .from("organizations")
    .insert({ id: orgId, name, slug, created_by: user.id });

  if (orgError) {
    // 23505 = unique violation (slug taken between check and insert).
    if (orgError.code === "23505") {
      return { error: `The slug "${slug}" is already taken.` };
    }
    return { error: orgError.message };
  }

  // 2) Add the creator as the owner (RLS allows inserting your own membership).
  const { error: memberError } = await supabase.from("org_members").insert({
    org_id: orgId,
    user_id: user.id,
    role: "owner",
  });

  if (memberError) {
    // Roll back the orphaned org so the user can retry cleanly.
    await createAdminClient().from("organizations").delete().eq("id", orgId);
    return { error: memberError.message };
  }

  redirect(`/${slug}/dashboard`);
}
