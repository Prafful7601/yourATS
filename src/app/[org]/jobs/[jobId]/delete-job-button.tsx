"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { deleteJob } from "../actions";

export function DeleteJobButton({
  slug,
  jobId,
}: {
  slug: string;
  jobId: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="destructive"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!confirm("Delete this job and its pipeline? This cannot be undone."))
          return;
        startTransition(async () => {
          try {
            await deleteJob(slug, jobId);
          } catch (e) {
            // redirect() throws by design; only surface real errors.
            if (e instanceof Error && !e.message.includes("NEXT_REDIRECT")) {
              toast.error(e.message);
            }
          }
        });
      }}
    >
      <Trash2 className="size-4" />
      {pending ? "Deleting…" : "Delete"}
    </Button>
  );
}
