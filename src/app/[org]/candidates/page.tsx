import { requireOrgMembership } from "@/lib/supabase/org";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { CandidatesList, type CandidateRow } from "./candidates-list";

export default async function CandidatesPage({
  params,
}: {
  params: { org: string };
}) {
  const { supabase, org } = await requireOrgMembership(params.org);

  const { data: candidates } = await supabase
    .from("candidates")
    .select(
      "id, full_name, email, phone, skills, created_at, applications(match_score)"
    )
    .eq("org_id", org.id)
    .order("created_at", { ascending: false });

  const rows: CandidateRow[] = (candidates ?? []).map((c) => {
    const apps = (c.applications as { match_score: number | null }[]) ?? [];
    const scores = apps
      .map((a) => a.match_score)
      .filter((s): s is number => s != null);
    return {
      id: c.id,
      full_name: c.full_name,
      email: c.email,
      phone: c.phone,
      skills: c.skills,
      created_at: c.created_at,
      appCount: apps.length,
      bestScore: scores.length > 0 ? Math.max(...scores) : null,
    };
  });

  return (
    <div className="mx-auto max-w-4xl p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Candidates</h1>
        <p className="text-sm text-muted-foreground">
          Everyone in your talent pool across all jobs.
        </p>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No candidates yet</CardTitle>
            <CardDescription>
              Add candidates from a job&apos;s pipeline board to see them here.
            </CardDescription>
          </CardHeader>
          <CardContent />
        </Card>
      ) : (
        <CandidatesList slug={org.slug} candidates={rows} />
      )}
    </div>
  );
}
