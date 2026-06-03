"use client";

import { useEffect, useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Check, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { createInvite, revokeInvite, type InviteState } from "./invite-actions";

export type PendingInvite = {
  id: string;
  email: string;
  role: string;
  link: string;
  invitedBy: string | null;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Inviting…" : "Send invite"}
    </Button>
  );
}

function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Copy invite link"
      onClick={async () => {
        await navigator.clipboard.writeText(link);
        setCopied(true);
        toast.success("Invite link copied.");
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
    </Button>
  );
}

const selectClass =
  "h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function InviteMembers({
  slug,
  pending: pendingInvites,
}: {
  slug: string;
  pending: PendingInvite[];
}) {
  const router = useRouter();
  const [state, formAction] = useFormState<InviteState, FormData>(createInvite, {
    error: null,
  });
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (state.link) {
      toast.success(
        state.emailed ? "Invite sent by email." : "Invite created — copy the link."
      );
      router.refresh();
    }
  }, [state, router]);

  return (
    <div className="grid gap-4">
      <form action={formAction} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="slug" value={slug} />
        <div className="grid flex-1 gap-1.5" style={{ minWidth: "12rem" }}>
          <label htmlFor="invite-email" className="text-xs text-muted-foreground">
            Email
          </label>
          <Input
            id="invite-email"
            name="email"
            type="email"
            placeholder="teammate@company.com"
            required
          />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="invite-role" className="text-xs text-muted-foreground">
            Role
          </label>
          <select id="invite-role" name="role" className={selectClass} defaultValue="recruiter">
            <option value="admin">Admin</option>
            <option value="recruiter">Recruiter</option>
            <option value="viewer">Viewer</option>
          </select>
        </div>
        <SubmitButton />
      </form>

      {state.error && (
        <p className="text-sm font-medium text-destructive">{state.error}</p>
      )}

      {pendingInvites.length > 0 && (
        <div className="grid gap-2">
          <p className="text-xs font-medium text-muted-foreground">
            Pending invites
          </p>
          <ul className="grid gap-2">
            {pendingInvites.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm"
              >
                <span className="min-w-0 flex-1 truncate">
                  {inv.email}
                  {inv.invitedBy && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      invited by {inv.invitedBy}
                    </span>
                  )}
                </span>
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs capitalize text-muted-foreground">
                  {inv.role}
                </span>
                <CopyLink link={inv.link} />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Revoke invite"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      const res = await revokeInvite(slug, inv.id);
                      if (res?.error) toast.error(res.error);
                      else router.refresh();
                    })
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
