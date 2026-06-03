"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { saveCandidateParse, uploadCandidateResume } from "../actions";

type ParseResponse = {
  email: string | null;
  phone: string | null;
  skills: string[];
  summary: string;
  source: "ai" | "fallback";
};

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

export function ResumePanel({
  slug,
  candidateId,
  initialResume,
  resumeUrl,
}: {
  slug: string;
  candidateId: string;
  initialResume: string;
  resumeUrl: string | null;
}) {
  const router = useRouter();
  const [resume, setResume] = useState(initialResume);
  const [parsed, setParsed] = useState<ParseResponse | null>(null);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function parseAndSave(text: string) {
    const res = await fetch(`/api/ai/parse-resume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error("Parsing failed.");
    const result = (await res.json()) as ParseResponse;
    setParsed(result);
    const saved = await saveCandidateParse(slug, candidateId, result.skills, {
      summary: result.summary,
      email: result.email,
      phone: result.phone,
      raw: text,
    });
    if (saved.error) throw new Error(saved.error);
    toast.success("Résumé parsed & saved.");
    router.refresh();
  }

  async function onPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Please choose a PDF file.");
      return;
    }
    setUploading(true);
    let text = "";
    try {
      text = await extractPdfText(file);
      if (text) setResume(text);
    } catch {
      /* scanned PDF — still store it */
    }
    const fd = new FormData();
    fd.set("file", file);
    const res = await uploadCandidateResume(slug, candidateId, fd);
    if (fileRef.current) fileRef.current.value = "";
    if (res.error) {
      setUploading(false);
      toast.error(res.error);
      return;
    }
    if (text.trim()) {
      try {
        await parseAndSave(text);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Parse failed.");
      }
    } else {
      toast.message("Résumé uploaded — couldn't read text (scanned PDF?). Paste text to parse.");
      router.refresh();
    }
    setUploading(false);
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
            View résumé
          </a>
        )}
      </div>

      <Textarea
        value={resume}
        onChange={(e) => setResume(e.target.value)}
        placeholder="Paste résumé text, or upload a PDF above to auto-fill…"
        rows={5}
      />
      <div>
        <Button
          size="sm"
          disabled={pending || uploading}
          onClick={() => {
            if (!resume.trim()) {
              toast.error("Paste résumé text or upload a PDF first.");
              return;
            }
            startTransition(async () => {
              try {
                await parseAndSave(resume);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Parse failed.");
              }
            });
          }}
        >
          <Sparkles className="size-4" />
          {pending ? "Parsing…" : "Parse résumé"}
        </Button>
      </div>

      {parsed && parsed.skills.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {parsed.skills.map((s) => (
            <Badge key={s} variant="secondary" className="font-normal">
              {s}
            </Badge>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Match scoring happens on each job&apos;s pipeline (résumé vs. that job).
      </p>
    </div>
  );
}
