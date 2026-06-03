import type { JobStatus } from "@/lib/supabase/types";

export const JOB_STATUSES: { value: JobStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "archived", label: "Archived" },
];

export const EMPLOYMENT_TYPES = [
  "Full-time",
  "Part-time",
  "Contract",
  "Internship",
  "Temporary",
] as const;

/** Pipeline stages seeded for every new job. */
export const DEFAULT_STAGES = [
  "Applied",
  "Screening",
  "Interview",
  "Offer",
  "Hired",
] as const;

export const STATUS_BADGE: Record<
  JobStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  draft: "secondary",
  open: "default",
  closed: "outline",
  archived: "destructive",
};
