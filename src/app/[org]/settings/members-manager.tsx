"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { OrgRole } from "@/lib/supabase/types";

import { removeMember, updateMemberRole } from "./members-actions";

export type MemberRow = {
  userId: string;
  role: OrgRole;
  name: string;
  email: string | null;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const selectClass =
  "h-8 rounded-md border border-input bg-background px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring capitalize";

export function MembersManager({
  slug,
  members,
  canManage,
  currentUserId,
}: {
  slug: string;
  members: MemberRow[];
  canManage: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function changeRole(userId: string, role: OrgRole) {
    startTransition(async () => {
      const res = await updateMemberRole(slug, userId, role);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Role updated.");
        router.refresh();
      }
    });
  }

  function remove(userId: string, name: string) {
    if (!confirm(`Remove ${name} from this workspace?`)) return;
    startTransition(async () => {
      const res = await removeMember(slug, userId);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Member removed.");
        router.refresh();
      }
    });
  }

  return (
    <ul className="grid gap-3">
      {members.map((m) => {
        const isOwner = m.role === "owner";
        const editable = canManage && !isOwner;
        return (
          <li key={m.userId} className="flex items-center gap-3">
            <Avatar className="size-8">
              <AvatarFallback className="text-xs">
                {initials(m.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {m.name}
                {m.userId === currentUserId && (
                  <span className="ml-1 text-xs text-muted-foreground">(you)</span>
                )}
              </p>
              {m.email && (
                <p className="truncate text-xs text-muted-foreground">{m.email}</p>
              )}
            </div>

            {editable ? (
              <>
                <select
                  className={selectClass}
                  defaultValue={m.role}
                  disabled={pending}
                  onChange={(e) => changeRole(m.userId, e.target.value as OrgRole)}
                  aria-label={`Role for ${m.name}`}
                >
                  <option value="admin">admin</option>
                  <option value="recruiter">recruiter</option>
                  <option value="viewer">viewer</option>
                </select>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${m.name}`}
                  disabled={pending}
                  onClick={() => remove(m.userId, m.name)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </>
            ) : (
              <Badge variant="outline" className="capitalize">
                {m.role}
              </Badge>
            )}
          </li>
        );
      })}
    </ul>
  );
}
