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

  const [{ data: profile }, { data: jobs }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase
      .from("jobs")
      .select("id, title, status")
      .eq("org_id", org.id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="flex min-h-screen bg-muted/30">
      <OrgSidebar
        slug={org.slug}
        orgName={org.name}
        fullName={profile?.full_name ?? null}
        email={user.email ?? ""}
        jobs={jobs ?? []}
      />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
