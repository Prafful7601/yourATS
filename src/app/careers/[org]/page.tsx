import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { createAdminClient } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui/badge";

export async function generateMetadata({
  params,
}: {
  params: { org: string };
}): Promise<Metadata> {
  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("name")
    .eq("slug", params.org)
    .maybeSingle();
  return { title: org ? `Careers at ${org.name}` : "Careers" };
}

export default async function CareersPage({
  params,
}: {
  params: { org: string };
}) {
  const admin = createAdminClient();

  const { data: org } = await admin
    .from("organizations")
    .select("id, name")
    .eq("slug", params.org)
    .maybeSingle();
  if (!org) notFound();

  const { data: jobs } = await admin
    .from("jobs")
    .select("id, title, location, department, employment_type")
    .eq("org_id", org.id)
    .eq("status", "open")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight">
        Careers at {org.name}
      </h1>
      <p className="mt-2 text-muted-foreground">
        {jobs && jobs.length > 0
          ? "Open roles we're hiring for right now."
          : "There are no open roles at the moment — check back soon."}
      </p>

      <div className="mt-8 grid gap-3">
        {jobs?.map((job) => (
          <Link
            key={job.id}
            href={`/careers/${params.org}/${job.id}`}
            className="block rounded-lg border bg-card p-5 transition-colors hover:bg-muted/50"
          >
            <p className="font-medium">{job.title}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[job.department, job.location, job.employment_type]
                .filter(Boolean)
                .map((tag) => (
                  <Badge key={tag as string} variant="secondary">
                    {tag}
                  </Badge>
                ))}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
