import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { OrgSidebar } from "@/components/org-sidebar";

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { org: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  // Verify the user is a member of THIS org (by slug).
  const { data: membership } = await supabase
    .from("org_members")
    .select("role, organizations!inner(id, name, slug)")
    .eq("user_id", user.id)
    .eq("organizations.slug", params.org)
    .maybeSingle();

  if (!membership) redirect("/sign-in");

  const org = membership.organizations as unknown as {
    id: string;
    name: string;
    slug: string;
  };

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="flex min-h-screen">
      <OrgSidebar
        slug={org.slug}
        orgName={org.name}
        fullName={profile?.full_name ?? null}
        email={user.email ?? ""}
      />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
