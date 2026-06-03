import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOrgMembership } from "@/lib/supabase/org";
import { createAdminClient } from "@/lib/supabase/admin";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { AIPanel } from "./ai-panel";
import { NotesSection, type Note } from "./notes-section";
import { ScorecardsSection, type Scorecard } from "./scorecards-section";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default async function ApplicationPage({
  params,
}: {
  params: { org: string; jobId: string; appId: string };
}) {
  const { supabase, org, user } = await requireOrgMembership(params.org);

  const { data: app } = await supabase
    .from("applications")
    .select(
      "id, status, match_score, candidate_id, candidates(full_name, email, phone, skills, resume_url, parsed_resume), jobs(title, description), job_stages(name)"
    )
    .eq("id", params.appId)
    .eq("org_id", org.id)
    .maybeSingle();

  if (!app) notFound();

  const candidate = app.candidates as unknown as {
    full_name: string;
    email: string | null;
    phone: string | null;
    skills: string[];
    resume_url: string | null;
    parsed_resume: { raw?: string } | null;
  };

  // Signed URL for the stored résumé (private bucket).
  let resumeUrl: string | null = null;
  if (candidate.resume_url) {
    const { data: signed } = await createAdminClient()
      .storage.from("resumes")
      .createSignedUrl(candidate.resume_url, 60 * 60);
    resumeUrl = signed?.signedUrl ?? null;
  }
  const job = app.jobs as unknown as {
    title: string;
    description: string | null;
  } | null;
  const stage = app.job_stages as unknown as { name: string } | null;

  // Notes + scorecards (+ author names via a profiles lookup).
  const [{ data: rawNotes }, { data: rawCards }] = await Promise.all([
    supabase
      .from("application_notes")
      .select("id, body, created_at, author_id")
      .eq("application_id", app.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("scorecards")
      .select("id, rating, feedback, created_at, author_id")
      .eq("application_id", app.id)
      .order("created_at", { ascending: false }),
  ]);

  const authorIds = Array.from(
    new Set(
      [...(rawNotes ?? []), ...(rawCards ?? [])]
        .map((r) => r.author_id)
        .filter((id): id is string => Boolean(id))
    )
  );
  const names = new Map<string, string>();
  if (authorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", authorIds);
    profiles?.forEach((p) => names.set(p.id, p.full_name ?? "Member"));
  }

  const notes: Note[] = (rawNotes ?? []).map((n) => ({
    id: n.id,
    body: n.body,
    created_at: n.created_at,
    authorId: n.author_id,
    authorName: n.author_id ? names.get(n.author_id) ?? "Member" : "Member",
  }));
  const scorecards: Scorecard[] = (rawCards ?? []).map((s) => ({
    id: s.id,
    rating: s.rating,
    feedback: s.feedback,
    created_at: s.created_at,
    authorId: s.author_id,
    authorName: s.author_id ? names.get(s.author_id) ?? "Member" : "Member",
  }));

  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mb-4">
        <Button
          variant="ghost"
          size="sm"
          render={
            <Link href={`/${org.slug}/jobs/${params.jobId}/board`}>
              ← Back to board
            </Link>
          }
        />
      </div>

      <div className="mb-6 flex items-start gap-4">
        <Avatar className="size-12">
          <AvatarFallback>{initials(candidate.full_name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              <Link
                href={`/${org.slug}/candidates/${app.candidate_id}`}
                className="hover:underline"
              >
                {candidate.full_name}
              </Link>
            </h1>
            {stage && <Badge variant="secondary">{stage.name}</Badge>}
            {app.match_score != null && (
              <Badge variant="outline">{app.match_score}% match</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {[candidate.email, candidate.phone].filter(Boolean).join(" · ") ||
              "No contact info"}
            {job ? ` — applying for ${job.title}` : ""}
          </p>
          {candidate.skills.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {candidate.skills.map((skill) => (
                <Badge key={skill} variant="secondary" className="font-normal">
                  {skill}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">Résumé &amp; AI</CardTitle>
          </CardHeader>
          <CardContent>
            <AIPanel
              slug={org.slug}
              jobId={params.jobId}
              appId={app.id}
              candidateId={app.candidate_id}
              jobText={job?.description ?? ""}
              hasJobText={Boolean(job?.description?.trim())}
              initialResume={candidate.parsed_resume?.raw ?? ""}
              resumeUrl={resumeUrl}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scorecards</CardTitle>
          </CardHeader>
          <CardContent>
            <ScorecardsSection
              slug={org.slug}
              jobId={params.jobId}
              appId={app.id}
              currentUserId={user.id}
              scorecards={scorecards}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <NotesSection
              slug={org.slug}
              jobId={params.jobId}
              appId={app.id}
              currentUserId={user.id}
              notes={notes}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
