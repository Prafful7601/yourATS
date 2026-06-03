"use client";

import { useFormState, useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { applyToJob, type ApplyState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Submitting…" : "Submit application"}
    </Button>
  );
}

export function ApplyForm({ slug, jobId }: { slug: string; jobId: string }) {
  const [state, formAction] = useFormState<ApplyState, FormData>(applyToJob, {
    error: null,
  });

  if (state.ok) {
    return (
      <div className="rounded-lg border bg-muted/40 p-6 text-center">
        <p className="font-medium">Application submitted 🎉</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Thanks for applying — the team will be in touch.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="jobId" value={jobId} />
      {/* Honeypot: hidden from humans, bots tend to fill it. */}
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />
      <div className="grid gap-2">
        <Label htmlFor="fullName">Full name</Label>
        <Input id="fullName" name="fullName" placeholder="Your name" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" placeholder="you@email.com" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" name="phone" placeholder="Optional" />
      </div>
      {state.error && (
        <p className="text-sm font-medium text-destructive">{state.error}</p>
      )}
      <SubmitButton />
    </form>
  );
}
