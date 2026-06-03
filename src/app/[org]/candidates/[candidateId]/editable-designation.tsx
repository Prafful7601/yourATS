"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { updateCandidateTitle } from "../actions";

export function EditableDesignation({
  slug,
  candidateId,
  title,
  fallback,
}: {
  slug: string;
  candidateId: string;
  title: string | null;
  fallback: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title ?? "");
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await updateCandidateTitle(slug, candidateId, value);
      if (res.error) toast.error(res.error);
      else {
        setEditing(false);
        router.refresh();
      }
    });
  }

  if (editing) {
    return (
      <div className="mt-0.5 flex items-center gap-1.5">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. Senior Frontend Engineer"
          className="h-7 w-64 text-sm"
          autoFocus
        />
        <Button size="icon-sm" variant="ghost" aria-label="Save" disabled={pending} onClick={save}>
          <Check className="size-4" />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Cancel"
          onClick={() => {
            setValue(title ?? "");
            setEditing(false);
          }}
        >
          <X className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="group mt-0.5 flex items-center gap-1.5 text-left"
    >
      <span
        className={
          title
            ? "text-sm font-medium text-foreground"
            : "text-sm text-muted-foreground"
        }
      >
        {title ?? fallback ?? "Add designation"}
      </span>
      <Pencil className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}
