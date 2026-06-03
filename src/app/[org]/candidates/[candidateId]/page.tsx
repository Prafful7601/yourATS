import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOrgMembership } from "@/lib/supabase/org";
import { createAdminClient } from "@/lib/supabase/admin";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { DeleteCandidateButton } from "./delete-candidate-button";
import { ResumePanel } from "./resume-panel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default async function CandidateProfilePage({
  params,
}: {
  params: { org: string; candidateId: string };
}) {
  const { supabase, org } = await requireOrgMembership(params.org);

  const { data: candidate } = await supabase
    .from("candidates")
    .select(
      "id, full_name, email, phone, source, skills, resume_url, parsed_resume, created_at"
    )
    .eq("id", params.candidateId)
    .eq("org_id", org.id)
    .maybeSingle();

  if (!candidate) notFound();

  let resumeUrl: string | null = null;
  if (candidate.resume_url) {
    const { data: signed } = await createAdminClient()
      .storage.from("resumes")
      .createSignedUrl(candidate.resume_url, 60 * 60);
    resumeUrl = signed?.signedUrl ?? null;
  }
  const parsedRaw =
    (candidate.parsed_resume as { raw?: string } | null)?.raw ?? "";

  const { data: applications } = await supabase
    .from("applications")
    .select("id, status, match_score, job_id, jobs(title), job_stages(name)")
    .eq("candidate_id", candidate.id)
    .order("applied_at", { ascending: false });

  // Designation = role from the most recent application.
  const designation =
    (applications?.[0]?.jobs as { title: string } | null)?.title ?? null;

  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mb-4">
        <Button
          variant="ghost"
          size="sm"
          render={<Link href={`/${org.slug}/candidates`}>← All candidates</Link>}
        />
      </div>

      <div className="mb-6 flex items-start gap-4">
        <Avatar className="size-14">
          <AvatarFallback>{initials(candidate.full_name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {candidate.full_name}
          </h1>
          {designation && (
            <p className="text-sm font-medium text-foreground">{designation}</p>
          )}
          <p className="text-sm text-muted-foreground">
            {[candidate.email, candidate.phone].filter(Boolean).join(" · ") ||
              "No contact info"}
            {candidate.source ? ` · via ${candidate.source}` : ""}
          </p>
          {candidate.skills.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {candidate.skills.map((s) => (
                <Badge key={s} variant="secondary" className="font-normal">
                  {s}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <DeleteCandidateButton slug={org.slug} candidateId={candidate.id} />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Résumé</CardTitle>
          <CardDescription>
            Upload a PDF or paste text to extract skills.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResumePanel
            slug={org.slug}
            candidateId={candidate.id}
            initialResume={parsedRaw}
            resumeUrl={resumeUrl}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Applications</CardTitle>
          <CardDescription>
            Jobs this candidate has been added to.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!applications || applications.length === 0 ? (
            <p className="text-sm text-muted-foreground">No applications yet.</p>
          ) : (
            <ul className="grid gap-2">
              {applications.map((a) => {
                const job = a.jobs as unknown as { title: string } | null;
                const stage = a.job_stages as unknown as { name: string } | null;
                return (
                  <li key={a.id}>
                    <Link
                      href={`/${org.slug}/jobs/${a.job_id}/applications/${a.id}`}
                      className="flex items-center justify-between gap-3 rounded-md border bg-background p-3 transition-colors hover:bg-muted/50"
                    >
                      <span className="truncate font-medium">
                        {job?.title ?? "Job"}
                      </span>
                      <div className="flex items-center gap-2">
                        {a.match_score != null && (
                          <Badge variant="outline">{a.match_score}%</Badge>
                        )}
                        {stage && <Badge variant="secondary">{stage.name}</Badge>}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
