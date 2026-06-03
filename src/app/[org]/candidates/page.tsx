import Link from "next/link";

import { requireOrgMembership } from "@/lib/supabase/org";
import { formatDistanceToNow } from "date-fns";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

export default async function CandidatesPage({
  params,
}: {
  params: { org: string };
}) {
  const { supabase, org } = await requireOrgMembership(params.org);

  const { data: candidates } = await supabase
    .from("candidates")
    .select("id, full_name, email, phone, created_at, applications(id)")
    .eq("org_id", org.id)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-4xl p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Candidates</h1>
        <p className="text-sm text-muted-foreground">
          Everyone in your talent pool across all jobs.
        </p>
      </div>

      {!candidates || candidates.length === 0 ? (
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
        <div className="grid gap-3">
          {candidates.map((c) => {
            const appCount = Array.isArray(c.applications)
              ? c.applications.length
              : 0;
            return (
              <Link
                key={c.id}
                href={`/${org.slug}/candidates/${c.id}`}
                className="flex items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50"
              >
                <Avatar className="size-9">
                  <AvatarFallback>{initials(c.full_name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.full_name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {c.email ?? c.phone ?? "No contact info"}
                  </p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>
                    {appCount} application{appCount === 1 ? "" : "s"}
                  </p>
                  <p>
                    added{" "}
                    {formatDistanceToNow(new Date(c.created_at), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
