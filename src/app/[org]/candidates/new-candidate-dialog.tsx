"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createCandidate, type NewCandidateState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Adding…" : "Add candidate"}
    </Button>
  );
}

export function NewCandidateDialog({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState<NewCandidateState, FormData>(
    createCandidate,
    { error: null }
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <Plus className="size-4" />
            New candidate
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New candidate</DialogTitle>
          <DialogDescription>
            Add someone to your talent pool. You can upload their résumé next.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="slug" value={slug} />
          <div className="grid gap-2">
            <Label htmlFor="fullName">Full name</Label>
            <Input id="fullName" name="fullName" placeholder="Ada Lovelace" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="title">Designation</Label>
            <Input id="title" name="title" placeholder="Senior Frontend Engineer" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" placeholder="ada@example.com" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" placeholder="Optional" />
          </div>
          {state.error && (
            <p className="text-sm font-medium text-destructive">{state.error}</p>
          )}
          <div className="flex justify-end">
            <SubmitButton />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
