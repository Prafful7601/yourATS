import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOrgMembership } from "@/lib/supabase/org";
import { Button } from "@/components/ui/button";

import { AddCandidateDialog } from "./add-candidate-dialog";
import { Board, type Column } from "./board";

export default async function BoardPage({
  params,
}: {
  params: { org: string; jobId: string };
}) {
  const { supabase, org } = await requireOrgMembership(params.org);

  const { data: job } = await supabase
    .from("jobs")
    .select("id, title")
    .eq("id", params.jobId)
    .eq("org_id", org.id)
    .maybeSingle();
  if (!job) notFound();

  const { data: stages } = await supabase
    .from("job_stages")
    .select("id, name, position")
    .eq("job_id", job.id)
    .order("position", { ascending: true });

  const { data: applications } = await supabase
    .from("applications")
    .select("id, stage_id, position, match_score, candidates(full_name, email)")
    .eq("job_id", job.id)
    .order("position", { ascending: true });

  const stageList = stages ?? [];
  const firstStageId = stageList[0]?.id;

  const columns: Column[] = stageList.map((stage) => ({
    id: stage.id,
    name: stage.name,
    cards: [],
  }));
  const byId = new Map(columns.map((c) => [c.id, c]));

  for (const app of applications ?? []) {
    const candidate = app.candidates as unknown as {
      full_name: string;
      email: string | null;
    } | null;
    // Fall back to the first stage if an app's stage was removed.
    const target = byId.get(app.stage_id ?? "") ?? byId.get(firstStageId ?? "");
    target?.cards.push({
      id: app.id,
      name: candidate?.full_name ?? "Unknown",
      email: candidate?.email ?? null,
      matchScore: app.match_score,
    });
  }

  const total = (applications ?? []).length;

  return (
    <div className="flex h-screen flex-col p-8">
      <div className="mb-2">
        <Button
          variant="ghost"
          size="sm"
          render={
            <Link href={`/${org.slug}/jobs/${job.id}`}>← Back to job</Link>
          }
        />
      </div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{job.title}</h1>
          <p className="text-sm text-muted-foreground">
            {total} candidate{total === 1 ? "" : "s"} in the pipeline
          </p>
        </div>
        <AddCandidateDialog slug={org.slug} jobId={job.id} />
      </div>

      {stageList.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Add pipeline stages on the job page first.
        </p>
      ) : (
        <div className="flex-1 overflow-hidden">
          <Board slug={org.slug} jobId={job.id} columns={columns} />
        </div>
      )}
    </div>
  );
}
