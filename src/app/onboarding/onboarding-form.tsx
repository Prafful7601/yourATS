"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { slugify } from "@/lib/slug";

import {
  checkSlugAvailability,
  createOrganization,
  type CreateOrgState,
} from "./actions";

const initialState: CreateOrgState = { error: null };

function SubmitButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending || disabled}>
      {pending ? "Creating…" : "Create organization"}
    </Button>
  );
}

export function OnboardingForm() {
  const [state, formAction] = useFormState(createOrganization, initialState);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);

  // Auto-generate the slug from the name until the user edits it manually.
  useEffect(() => {
    if (!slugEdited) setSlug(slugify(name));
  }, [name, slugEdited]);

  // Debounced availability check.
  useEffect(() => {
    if (!slug) {
      setAvailable(null);
      return;
    }
    let active = true;
    const t = setTimeout(async () => {
      const { available } = await checkSlugAvailability(slug);
      if (active) setAvailable(available);
    }, 400);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [slug]);

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="name">Organization name</Label>
        <Input
          id="name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Acme Inc."
          required
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="slug">Workspace URL</Label>
        <div className="flex items-center rounded-md border border-input bg-background pl-3 text-sm focus-within:ring-1 focus-within:ring-ring">
          <span className="text-muted-foreground">yourats.com/</span>
          <Input
            id="slug"
            name="slug"
            value={slug}
            onChange={(e) => {
              setSlugEdited(true);
              setSlug(slugify(e.target.value));
            }}
            className="border-0 px-1 focus-visible:ring-0"
            placeholder="acme"
            required
          />
        </div>
        {slug && available === false && (
          <p className="text-sm font-medium text-destructive">
            “{slug}” is taken — try another.
          </p>
        )}
        {slug && available === true && (
          <p className="text-sm text-muted-foreground">“{slug}” is available.</p>
        )}
      </div>

      {state.error && (
        <p className="text-sm font-medium text-destructive">{state.error}</p>
      )}

      <SubmitButton disabled={available === false} />
    </form>
  );
}
