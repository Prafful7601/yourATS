import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { OrgRole } from "@/lib/supabase/types";

export type OrgContext = {
  supabase: ReturnType<typeof createClient>;
  user: { id: string; email: string | null };
  org: { id: string; name: string; slug: string };
  role: OrgRole;
};

/**
 * Resolves the current user and verifies they are a member of the org
 * identified by `slug`. Redirects to /sign-in when unauthenticated or not a
 * member. Used by every page/action under /[org].
 */
export async function requireOrgMembership(slug: string): Promise<OrgContext> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: membership } = await supabase
    .from("org_members")
    .select("role, organizations!inner(id, name, slug)")
    .eq("user_id", user.id)
    .eq("organizations.slug", slug)
    .maybeSingle();

  if (!membership) redirect("/sign-in");

  const org = membership.organizations as unknown as {
    id: string;
    name: string;
    slug: string;
  };

  return {
    supabase,
    user: { id: user.id, email: user.email ?? null },
    org,
    role: membership.role as OrgRole,
  };
}
