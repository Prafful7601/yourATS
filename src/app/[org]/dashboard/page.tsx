import { requireOrgMembership } from "@/lib/supabase/org";

export default async function DashboardPage({
  params,
}: {
  params: { org: string };
}) {
  const { org } = await requireOrgMembership(params.org);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold tracking-tight">
        Welcome to {org.name}
      </h1>
      <p className="mt-2 text-muted-foreground">
        Your dashboard is ready. Jobs, candidates, and your pipeline will live
        here.
      </p>
    </div>
  );
}
