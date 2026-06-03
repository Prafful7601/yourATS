"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { saveMatchScore, saveResumeParse, uploadResume } from "./actions";

/** Best-effort client-side PDF text extraction via pdf.js. */
async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  let text = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text +=
      content.items
        .map((it) => ("str" in it ? (it as { str: string }).str : ""))
        .join(" ") + "\n";
  }
  return text.replace(/\s+\n/g, "\n").trim();
}

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
  resumeUrl,
}: {
  slug: string;
  jobId: string;
  appId: string;
  candidateId: string;
  jobText: string;
  initialResume: string;
  hasJobText: boolean;
  resumeUrl: string | null;
}) {
  const router = useRouter();
  const [resume, setResume] = useState(initialResume);
  const [parse, setParse] = useState<ParseResponse | null>(null);
  const [match, setMatch] = useState<MatchResponse | null>(null);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Please choose a PDF file.");
      return;
    }
    setUploading(true);
    // Extract text first (best-effort) so we can parse + score it.
    let text = "";
    try {
      text = await extractPdfText(file);
      if (text) setResume(text);
    } catch {
      // image-only/scanned PDF — we'll still store the file
    }
    // Upload the file to storage and save it on the candidate.
    const fd = new FormData();
    fd.set("file", file);
    const res = await uploadResume(slug, jobId, appId, candidateId, fd);
    if (fileRef.current) fileRef.current.value = "";
    if (res.error) {
      setUploading(false);
      toast.error(res.error);
      return;
    }
    // Auto parse + score from the extracted text (hands-free).
    if (text.trim()) {
      try {
        await processResume(text);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "AI request failed after upload.");
      }
    } else {
      toast.message("Résumé uploaded — couldn't read text (scanned PDF?). Paste text to score.");
      router.refresh();
    }
    setUploading(false);
  }

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

  // Parse the résumé AND auto-score it against the job, in one pass.
  async function processResume(text: string) {
    const parsed = await callAi<ParseResponse>("parse-resume", { text });
    setParse(parsed);
    const r1 = await saveResumeParse(slug, jobId, appId, candidateId, parsed.skills, {
      summary: parsed.summary,
      email: parsed.email,
      phone: parsed.phone,
      raw: text,
    });
    if (r1.error) {
      toast.error(r1.error);
      return;
    }

    if (hasJobText) {
      const m = await callAi<MatchResponse>("match-score", { text, jobText });
      setMatch(m);
      const r2 = await saveMatchScore(slug, jobId, appId, m.score);
      if (r2.error) {
        toast.error(r2.error);
        return;
      }
      toast.success(`Parsed & scored ${m.score}% (${sourceLabel(m.source)}).`);
    } else {
      toast.success("Parsed & saved. Add a job description to auto-score.");
    }
    router.refresh();
  }

  function runProcess() {
    if (!resume.trim()) {
      toast.error("Paste résumé text or upload a PDF first.");
      return;
    }
    startTransition(async () => {
      try {
        await processResume(resume);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "AI request failed.");
      }
    });
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="size-4" />
          {uploading ? "Uploading…" : "Upload PDF résumé"}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={onPdf}
        />
        {resumeUrl && (
          <a
            href={resumeUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline"
          >
            <FileText className="size-4" />
            View current résumé
          </a>
        )}
      </div>

      <Textarea
        value={resume}
        onChange={(e) => setResume(e.target.value)}
        placeholder="Paste résumé text, or upload a PDF above to auto-fill…"
        rows={6}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={pending || uploading} onClick={runProcess}>
          <Sparkles className="size-4" />
          {pending ? "Working…" : hasJobText ? "Parse & score résumé" : "Parse résumé"}
        </Button>
        <span className="self-center text-xs text-muted-foreground">
          {hasJobText
            ? "Uploading a PDF parses & scores automatically."
            : "Add a job description to auto-score on parse."}
        </span>
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
