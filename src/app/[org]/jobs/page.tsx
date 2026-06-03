import Link from "next/link";

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

export default async function JobsPage({
  params,
}: {
  params: { org: string };
}) {
  const { supabase, org } = await requireOrgMembership(params.org);

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, title, department, location, status, created_at")
    .eq("org_id", org.id)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-5xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
          <p className="text-sm text-muted-foreground">
            Manage your open roles and their pipelines.
          </p>
        </div>
        <Button render={<Link href={`/${org.slug}/jobs/new`}>New job</Link>} />
      </div>

      {!jobs || jobs.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No jobs yet</CardTitle>
            <CardDescription>
              Create your first job posting to start building a pipeline.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              render={<Link href={`/${org.slug}/jobs/new`}>Create a job</Link>}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {jobs.map((job) => (
            <Link
              key={job.id}
              href={`/${org.slug}/jobs/${job.id}`}
              className="block rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{job.title}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {[job.department, job.location]
                      .filter(Boolean)
                      .join(" · ") || "No details yet"}
                  </p>
                </div>
                <Badge variant={STATUS_BADGE[job.status]} className="capitalize">
                  {job.status}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
