"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { deleteCandidate } from "../actions";

export function DeleteCandidateButton({
  slug,
  candidateId,
}: {
  slug: string;
  candidateId: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="destructive"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (
          !confirm(
            "Delete this candidate? This removes their applications, notes, scorecards, and résumé. This cannot be undone."
          )
        )
          return;
        startTransition(async () => {
          try {
            await deleteCandidate(slug, candidateId);
          } catch (e) {
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
