import { requireOrgMembership } from "@/lib/supabase/org";
import { OrgSidebar } from "@/components/org-sidebar";

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { org: string };
}) {
  const { supabase, user, org } = await requireOrgMembership(params.org);

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
