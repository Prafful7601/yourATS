"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EMPLOYMENT_TYPES, JOB_STATUSES } from "@/lib/jobs";
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/supabase/types";

import { createJob, updateJob, type JobFormState } from "./actions";

type Job = Database["public"]["Tables"]["jobs"]["Row"];

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

export function JobForm({ slug, job }: { slug: string; job?: Job }) {
  const isEdit = Boolean(job);
  const action = isEdit ? updateJob : createJob;
  const [state, formAction] = useFormState<JobFormState, FormData>(action, {
    error: null,
  });
  const wasPending = useRef(false);

  // On a successful edit save (no error after submit), confirm with a toast.
  useEffect(() => {
    if (isEdit && state.error === null && wasPending.current) {
      toast.success("Job saved.");
    }
    wasPending.current = false;
  }, [state, isEdit]);

  return (
    <form
      action={formAction}
      onSubmit={() => {
        wasPending.current = true;
      }}
      className="grid gap-5"
    >
      <input type="hidden" name="slug" value={slug} />
      {job && <input type="hidden" name="jobId" value={job.id} />}

      <div className="grid gap-2">
        <Label htmlFor="title">Job title</Label>
        <Input
          id="title"
          name="title"
          defaultValue={job?.title ?? ""}
          placeholder="Senior Frontend Engineer"
          required
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="department">Department</Label>
          <Input
            id="department"
            name="department"
            defaultValue={job?.department ?? ""}
            placeholder="Engineering"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            name="location"
            defaultValue={job?.location ?? ""}
            placeholder="Remote · Berlin"
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="employment_type">Employment type</Label>
          <select
            id="employment_type"
            name="employment_type"
            defaultValue={job?.employment_type ?? ""}
            className={selectClass}
          >
            <option value="">Unspecified</option>
            {EMPLOYMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            name="status"
            defaultValue={job?.status ?? "draft"}
            className={selectClass}
          >
            {JOB_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={job?.description ?? ""}
          placeholder="Role overview, responsibilities, requirements…"
          rows={8}
        />
      </div>

      {state.error && (
        <p className={cn("text-sm font-medium text-destructive")}>
          {state.error}
        </p>
      )}

      <div className="flex justify-end">
        <SubmitButton label={isEdit ? "Save changes" : "Create job"} />
      </div>
    </form>
  );
}
