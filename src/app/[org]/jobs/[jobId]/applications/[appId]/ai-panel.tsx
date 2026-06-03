"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { saveMatchScore, saveResumeParse } from "./actions";

type ParseResponse = {
  email: string | null;
  phone: string | null;
  skills: string[];
  summary: string;
  source: "ai" | "fallback";
};
type MatchResponse = {
  score: number;
  rationale: string;
  source: "ai" | "fallback";
};

function sourceLabel(source: "ai" | "fallback") {
  return source === "ai" ? "Hugging Face" : "heuristic fallback";
}

export function AIPanel({
  slug,
  jobId,
  appId,
  candidateId,
  jobText,
  initialResume,
  hasJobText,
}: {
  slug: string;
  jobId: string;
  appId: string;
  candidateId: string;
  jobText: string;
  initialResume: string;
  hasJobText: boolean;
}) {
  const router = useRouter();
  const [resume, setResume] = useState(initialResume);
  const [parse, setParse] = useState<ParseResponse | null>(null);
  const [match, setMatch] = useState<MatchResponse | null>(null);
  const [pending, startTransition] = useTransition();

  async function callAi<T>(action: string, payload: object): Promise<T> {
    const res = await fetch(`/api/ai/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "AI error" }));
      throw new Error(error ?? "AI error");
    }
    return res.json() as Promise<T>;
  }

  function parseAndSave() {
    if (!resume.trim()) {
      toast.error("Paste the résumé text first.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await callAi<ParseResponse>("parse-resume", {
          text: resume,
        });
        setParse(result);
        const res = await saveResumeParse(slug, jobId, appId, candidateId, result.skills, {
          summary: result.summary,
          email: result.email,
          phone: result.phone,
          raw: resume,
        });
        if (res.error) toast.error(res.error);
        else {
          toast.success(`Parsed via ${sourceLabel(result.source)} & saved.`);
          router.refresh();
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Parsing failed.");
      }
    });
  }

  function scoreMatch() {
    const candidateText = resume.trim() || parse?.skills.join(", ") || "";
    if (!candidateText) {
      toast.error("Add résumé text to score the match.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await callAi<MatchResponse>("match-score", {
          text: candidateText,
          jobText,
        });
        setMatch(result);
        const res = await saveMatchScore(slug, jobId, appId, result.score);
        if (res.error) toast.error(res.error);
        else {
          toast.success(`Scored via ${sourceLabel(result.source)} & saved.`);
          router.refresh();
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Scoring failed.");
      }
    });
  }

  return (
    <div className="grid gap-4">
      <Textarea
        value={resume}
        onChange={(e) => setResume(e.target.value)}
        placeholder="Paste the candidate's résumé text here…"
        rows={6}
      />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={pending} onClick={parseAndSave}>
          <Sparkles className="size-4" />
          {pending ? "Working…" : "Parse résumé & save"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending || !hasJobText}
          onClick={scoreMatch}
        >
          Score match
        </Button>
        {!hasJobText && (
          <span className="self-center text-xs text-muted-foreground">
            Add a job description to enable match scoring.
          </span>
        )}
      </div>

      {parse && (
        <div className="rounded-md border bg-background p-3 text-sm">
          <div className="mb-1 flex items-center gap-2">
            <span className="font-medium">Parsed</span>
            <Badge variant="secondary">{sourceLabel(parse.source)}</Badge>
          </div>
          {parse.skills.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1">
              {parse.skills.map((s) => (
                <Badge key={s} variant="outline" className="font-normal">
                  {s}
                </Badge>
              ))}
            </div>
          )}
          <p className="text-muted-foreground">{parse.summary}</p>
        </div>
      )}

      {match && (
        <div className="rounded-md border bg-background p-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="font-medium">Match score: {match.score}%</span>
            <Badge variant="secondary">{sourceLabel(match.source)}</Badge>
          </div>
          <p className="mt-1 text-muted-foreground">{match.rationale}</p>
        </div>
      )}
    </div>
  );
}
