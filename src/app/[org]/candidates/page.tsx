import { Users } from "lucide-react";

import { requireOrgMembership } from "@/lib/supabase/org";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { CandidatesList, type CandidateRow } from "./candidates-list";
import { ImportDialog } from "./import-dialog";
import { NewCandidateDialog } from "./new-candidate-dialog";

export default async function CandidatesPage({
  params,
}: {
  params: { org: string };
}) {
  const { supabase, org } = await requireOrgMembership(params.org);

  const { data: candidates } = await supabase
    .from("candidates")
    .select(
      "id, full_name, title, email, phone, skills, created_at, applications(match_score, applied_at, jobs(title))"
    )
    .eq("org_id", org.id)
    .order("created_at", { ascending: false });

  const rows: CandidateRow[] = (candidates ?? []).map((c) => {
    const apps =
      (c.applications as {
        match_score: number | null;
        applied_at: string;
        jobs: { title: string } | null;
      }[]) ?? [];
    const scores = apps
      .map((a) => a.match_score)
      .filter((s): s is number => s != null);
    // Designation = the role from their most recent application.
    const latest = [...apps].sort(
      (a, b) => +new Date(b.applied_at) - +new Date(a.applied_at)
    )[0];
    return {
      id: c.id,
      full_name: c.full_name,
      email: c.email,
      phone: c.phone,
      designation: c.title ?? latest?.jobs?.title ?? null,
      skills: c.skills,
      created_at: c.created_at,
      appCount: apps.length,
      bestScore: scores.length > 0 ? Math.max(...scores) : null,
    };
  });

  return (
    <div className="mx-auto max-w-4xl p-8">
      <PageHeader
        title="Candidates"
        description="Everyone in your talent pool across all jobs."
        icon={Users}
      >
        <ImportDialog slug={org.slug} />
        <NewCandidateDialog slug={org.slug} />
      </PageHeader>

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
