import { Settings as SettingsIcon } from "lucide-react";

import { requireOrgMembership } from "@/lib/supabase/org";
import { PageHeader } from "@/components/page-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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

export default async function SettingsPage({
  params,
}: {
  params: { org: string };
}) {
  const { supabase, org, role } = await requireOrgMembership(params.org);

  const { data: members } = await supabase
    .from("org_members")
    .select("user_id, role, created_at")
    .eq("org_id", org.id)
    .order("created_at", { ascending: true });

  const ids = (members ?? []).map((m) => m.user_id);
  const names = new Map<string, { full_name: string | null; email: string }>();
  if (ids.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", ids);
    profiles?.forEach((p) =>
      names.set(p.id, { full_name: p.full_name, email: p.email })
    );
  }

  const careersUrl = `/careers/${org.slug}`;

  return (
    <div className="mx-auto max-w-3xl p-8">
      <PageHeader
        title="Settings"
        description="Your workspace configuration and members."
        icon={SettingsIcon}
      />

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Organization</CardTitle>
            <CardDescription>Your workspace details.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{org.name}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Workspace URL</span>
              <span className="font-medium">yourats.online/{org.slug}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Your role</span>
              <Badge variant="secondary" className="capitalize">
                {role}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Public careers page</span>
              <a
                href={careersUrl}
                target="_blank"
                rel="noreferrer"
                className="font-medium underline-offset-4 hover:underline"
              >
                yourats.online{careersUrl}
              </a>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Members</CardTitle>
            <CardDescription>
              People with access to this workspace.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-3">
              {(members ?? []).map((m) => {
                const p = names.get(m.user_id);
                const display = p?.full_name ?? p?.email ?? "Member";
                return (
                  <li key={m.user_id} className="flex items-center gap-3">
                    <Avatar className="size-8">
                      <AvatarFallback className="text-xs">
                        {initials(display)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{display}</p>
                      {p?.email && (
                        <p className="truncate text-xs text-muted-foreground">
                          {p.email}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {m.role}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
