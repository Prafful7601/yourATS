import Link from "next/link";
import { notFound } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui/badge";

import { ApplyForm } from "./apply-form";

export default async function CareersJobPage({
  params,
}: {
  params: { org: string; jobId: string };
}) {
  const admin = createAdminClient();

  const { data: org } = await admin
    .from("organizations")
    .select("id, name")
    .eq("slug", params.org)
    .maybeSingle();
  if (!org) notFound();

  // Only open jobs are publicly viewable.
  const { data: job } = await admin
    .from("jobs")
    .select("id, title, description, location, department, employment_type, status")
    .eq("id", params.jobId)
    .eq("org_id", org.id)
    .maybeSingle();
  if (!job || job.status !== "open") notFound();

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <Link
        href={`/careers/${params.org}`}
        className="text-sm text-muted-foreground hover:underline"
      >
        ← All roles at {org.name}
      </Link>

      <h1 className="mt-4 text-3xl font-bold tracking-tight">{job.title}</h1>
      <div className="mt-3 flex flex-wrap gap-2">
        {[job.department, job.location, job.employment_type]
          .filter(Boolean)
          .map((tag) => (
            <Badge key={tag as string} variant="secondary">
              {tag}
            </Badge>
          ))}
      </div>

      {job.description && (
        <div className="mt-8 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
          {job.description}
        </div>
      )}

      <div className="mt-10 border-t pt-8">
        <h2 className="mb-4 text-lg font-semibold">Apply for this role</h2>
        <ApplyForm slug={params.org} jobId={job.id} />
      </div>
    </div>
  );
}
