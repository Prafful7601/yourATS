"use client";

import { useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { addScorecard, deleteScorecard } from "./actions";

export type Scorecard = {
  id: string;
  rating: number | null;
  feedback: string | null;
  created_at: string;
  authorId: string | null;
  authorName: string;
};

function Stars({
  value,
  onChange,
}: {
  value: number;
  onChange?: (n: number) => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          className={cn(onChange && "cursor-pointer")}
        >
          <Star
            className={cn(
              "size-4",
              n <= value
                ? "fill-amber-400 text-amber-400"
                : "text-muted-foreground/40"
            )}
          />
        </button>
      ))}
    </div>
  );
}

export function ScorecardsSection({
  slug,
  jobId,
  appId,
  currentUserId,
  scorecards,
}: {
  slug: string;
  jobId: string;
  appId: string;
  currentUserId: string;
  scorecards: Scorecard[];
}) {
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [pending, startTransition] = useTransition();

  const rated = scorecards.filter((s) => s.rating != null);
  const avg =
    rated.length > 0
      ? (rated.reduce((sum, s) => sum + (s.rating ?? 0), 0) / rated.length).toFixed(
          1
        )
      : null;

  function submit() {
    if (rating < 1) {
      toast.error("Pick a rating from 1 to 5.");
      return;
    }
    startTransition(async () => {
      const res = await addScorecard(slug, jobId, appId, rating, feedback);
      if (res.error) toast.error(res.error);
      else {
        setRating(0);
        setFeedback("");
      }
    });
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-2 rounded-md border bg-background p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Your scorecard</span>
          <Stars value={rating} onChange={setRating} />
        </div>
        <Textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Strengths, concerns, recommendation…"
          rows={3}
        />
        <div className="flex justify-end">
          <Button size="sm" disabled={pending} onClick={submit}>
            {pending ? "Submitting…" : "Submit scorecard"}
          </Button>
        </div>
      </div>

      {avg && (
        <p className="text-sm text-muted-foreground">
          Average rating: <span className="font-medium text-foreground">{avg}</span>{" "}
          across {rated.length} scorecard{rated.length === 1 ? "" : "s"}
        </p>
      )}

      {scorecards.length === 0 ? (
        <p className="text-sm text-muted-foreground">No scorecards yet.</p>
      ) : (
        <ul className="grid gap-3">
          {scorecards.map((s) => (
            <li key={s.id} className="rounded-md border bg-background p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{s.authorName}</span>
                  <Stars value={s.rating ?? 0} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(s.created_at), {
                      addSuffix: true,
                    })}
                  </span>
                  {s.authorId === currentUserId && (
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      aria-label="Delete scorecard"
                      onClick={() =>
                        startTransition(async () => {
                          const res = await deleteScorecard(
                            slug,
                            jobId,
                            appId,
                            s.id
                          );
                          if (res.error) toast.error(res.error);
                        })
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>
              {s.feedback && (
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {s.feedback}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
