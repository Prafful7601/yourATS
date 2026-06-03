import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOrgMembership } from "@/lib/supabase/org";
import { STATUS_BADGE } from "@/lib/jobs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { JobForm } from "../job-form";
import { StageManager } from "./stage-manager";
import { DeleteJobButton } from "./delete-job-button";

export default async function JobDetailPage({
  params,
}: {
  params: { org: string; jobId: string };
}) {
  const { supabase, org } = await requireOrgMembership(params.org);

  const { data: job } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", params.jobId)
    .eq("org_id", org.id)
    .maybeSingle();

  if (!job) notFound();

  const { data: stages } = await supabase
    .from("job_stages")
    .select("id, name, position")
    .eq("job_id", job.id)
    .order("position", { ascending: true });

  return (
    <div className="mx-auto max-w-2xl p-8">
      <div className="mb-4">
        <Button
          variant="ghost"
          size="sm"
          render={<Link href={`/${org.slug}/jobs`}>← Back to jobs</Link>}
        />
      </div>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">
            {job.title}
          </h1>
          <div className="mt-1">
            <Badge variant={STATUS_BADGE[job.status]} className="capitalize">
              {job.status}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            render={
              <Link href={`/${org.slug}/jobs/${job.id}/board`}>
                Open pipeline board
              </Link>
            }
          />
          <DeleteJobButton slug={org.slug} jobId={job.id} />
        </div>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
            <CardDescription>Edit the role information.</CardDescription>
          </CardHeader>
          <CardContent>
            <JobForm slug={org.slug} job={job} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pipeline stages</CardTitle>
            <CardDescription>
              Candidates move through these stages on the board.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StageManager
              slug={org.slug}
              jobId={job.id}
              stages={stages ?? []}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
