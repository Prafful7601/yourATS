import Link from "next/link";

import { requireOrgMembership } from "@/lib/supabase/org";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { JobForm } from "../job-form";

export default async function NewJobPage({
  params,
}: {
  params: { org: string };
}) {
  const { org } = await requireOrgMembership(params.org);

  return (
    <div className="mx-auto max-w-2xl p-8">
      <div className="mb-4">
        <Button
          variant="ghost"
          size="sm"
          render={<Link href={`/${org.slug}/jobs`}>← Back to jobs</Link>}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>New job</CardTitle>
          <CardDescription>
            We&apos;ll seed a default pipeline (Applied → Screening → Interview →
            Offer → Hired) you can customize afterwards.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <JobForm slug={org.slug} />
        </CardContent>
      </Card>
    </div>
  );
}
