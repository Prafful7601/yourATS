import Link from "next/link";
import { Briefcase, KanbanSquare, Plus, Users } from "lucide-react";

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

async function count(
  query: PromiseLike<{ count: number | null }>
): Promise<number> {
  const { count } = await query;
  return count ?? 0;
}

export default async function DashboardPage({
  params,
}: {
  params: { org: string };
}) {
  const { supabase, org } = await requireOrgMembership(params.org);

  const base = () => supabase.from("jobs").select("id", { count: "exact", head: true });

  const [openJobs, totalJobs, candidates, activeApps] = await Promise.all([
    count(base().eq("org_id", org.id).eq("status", "open")),
    count(base().eq("org_id", org.id)),
    count(
      supabase
        .from("candidates")
        .select("id", { count: "exact", head: true })
        .eq("org_id", org.id)
    ),
    count(
      supabase
        .from("applications")
        .select("id", { count: "exact", head: true })
        .eq("org_id", org.id)
        .eq("status", "active")
    ),
  ]);

  const { data: recentJobs } = await supabase
    .from("jobs")
    .select("id, title, status, department, location")
    .eq("org_id", org.id)
    .order("created_at", { ascending: false })
    .limit(5);

  const stats = [
    {
      label: "Open jobs",
      value: openJobs,
      icon: Briefcase,
      tile: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Total jobs",
      value: totalJobs,
      icon: Briefcase,
      tile: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    },
    {
      label: "Candidates",
      value: candidates,
      icon: Users,
      tile: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    },
    {
      label: "Active applications",
      value: activeApps,
      icon: KanbanSquare,
      tile: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
  ];

  return (
    <div className="mx-auto max-w-5xl p-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {org.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Here&apos;s what&apos;s happening in your workspace.
          </p>
        </div>
        <Button render={<Link href={`/${org.slug}/jobs/new`}>
          <Plus className="size-4" />
          New job
        </Link>} />
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, tile }) => (
          <Card
            key={label}
            className="transition-shadow hover:shadow-md"
          >
            <CardContent className="flex items-center gap-3 p-4">
              <div
                className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${tile}`}
              >
                <Icon className="size-5" />
              </div>
              <div>
                <p className="text-2xl font-semibold tabular-nums">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Recent jobs</CardTitle>
            <CardDescription>Your latest postings.</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            render={<Link href={`/${org.slug}/jobs`}>View all</Link>}
          />
        </CardHeader>
        <CardContent>
          {!recentJobs || recentJobs.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                No jobs yet. Post your first role to start hiring.
              </p>
              <Button
                size="sm"
                render={
                  <Link href={`/${org.slug}/jobs/new`}>Create a job</Link>
                }
              />
            </div>
          ) : (
            <ul className="divide-y">
              {recentJobs.map((job) => (
                <li key={job.id}>
                  <Link
                    href={`/${org.slug}/jobs/${job.id}`}
                    className="flex items-center justify-between gap-3 py-3 transition-colors hover:opacity-80"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {job.title}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[job.department, job.location]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </p>
                    </div>
                    <Badge
                      variant={STATUS_BADGE[job.status]}
                      className="capitalize"
                    >
                      {job.status}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
