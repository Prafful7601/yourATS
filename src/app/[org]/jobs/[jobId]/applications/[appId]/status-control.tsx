"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { ApplicationStatus } from "@/lib/supabase/types";

import { updateApplicationStatus } from "./actions";

const OPTIONS: { value: ApplicationStatus; label: string; active: string }[] = [
  { value: "active", label: "Active", active: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  { value: "hired", label: "Hired", active: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  { value: "rejected", label: "Rejected", active: "bg-destructive/15 text-destructive" },
  { value: "withdrawn", label: "Withdrawn", active: "bg-muted text-muted-foreground" },
];

export function StatusControl({
  slug,
  jobId,
  appId,
  status,
}: {
  slug: string;
  jobId: string;
  appId: string;
  status: ApplicationStatus;
}) {
  const [pending, startTransition] = useTransition();

  function set(next: ApplicationStatus) {
    if (next === status) return;
    startTransition(async () => {
      const res = await updateApplicationStatus(slug, jobId, appId, next);
      if (res.error) toast.error(res.error);
      else toast.success(`Marked ${next}.`);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {OPTIONS.map((o) => (
        <Button
          key={o.value}
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => set(o.value)}
          className={cn(
            "h-7 px-2.5 text-xs",
            status === o.value
              ? o.active
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.label}
        </Button>
      ))}
    </div>
  );
}
