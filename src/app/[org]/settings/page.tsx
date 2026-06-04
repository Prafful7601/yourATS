import { Settings as SettingsIcon } from "lucide-react";

import { requireOrgMembership } from "@/lib/supabase/org";
import { getBaseUrl } from "@/lib/url";
import { PageHeader } from "@/components/page-header";
import { InviteMembers } from "./invite-members";
import { MembersManager } from "./members-manager";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function SettingsPage({
  params,
}: {
  params: { org: string };
}) {
  const { supabase, user, org, role } = await requireOrgMembership(params.org);

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

  // Pending invites (owners/admins only). Guarded so Settings still loads if
  // the org_invitations table hasn't been migrated yet.
  const canInvite = role === "owner" || role === "admin";
  const appUrl = getBaseUrl();
  let pendingInvites: {
    id: string;
    email: string;
    role: string;
    link: string;
    invitedBy: string | null;
  }[] = [];
  if (canInvite) {
    const { data: invites } = await supabase
      .from("org_invitations")
      .select("id, email, role, invited_by")
      .eq("org_id", org.id)
      .is("accepted_at", null)
      .order("created_at", { ascending: false });
    // Resolve inviter names (already loaded for members; fetch any extras).
    const inviterIds = (invites ?? [])
      .map((i) => i.invited_by)
      .filter((id): id is string => !!id && !names.has(id));
    if (inviterIds.length > 0) {
      const { data: extra } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", inviterIds);
      extra?.forEach((p) =>
        names.set(p.id, { full_name: p.full_name, email: p.email })
      );
    }
    pendingInvites = (invites ?? []).map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      link: `${appUrl}/invite/${i.id}`,
      invitedBy: i.invited_by
        ? names.get(i.invited_by)?.full_name ??
          names.get(i.invited_by)?.email ??
          null
        : null,
    }));
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

        {canInvite && (
          <Card>
            <CardHeader>
              <CardTitle>Invite members</CardTitle>
              <CardDescription>
                Invite teammates by email. They&apos;ll get a link to join this
                workspace.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <InviteMembers slug={org.slug} pending={pendingInvites} />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Members</CardTitle>
            <CardDescription>
              People with access to this workspace.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MembersManager
              slug={org.slug}
              canManage={canInvite}
              currentUserId={user.id}
              members={(members ?? []).map((m) => {
                const p = names.get(m.user_id);
                return {
                  userId: m.user_id,
                  role: m.role,
                  name: p?.full_name ?? p?.email ?? "Member",
                  email: p?.email ?? null,
                };
              })}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
