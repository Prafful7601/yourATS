"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { importCandidates, type ImportRow } from "./actions";

function pick(row: Record<string, unknown>, keys: string[]): string {
  for (const k of Object.keys(row)) {
    const norm = k.toLowerCase().replace(/[^a-z]/g, "");
    if (keys.some((want) => norm.includes(want))) {
      const v = row[k];
      if (v != null && String(v).trim()) return String(v).trim();
    }
  }
  return "";
}

export function ImportDialog({ slug }: { slug: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParsing(true);
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
      });
      const parsed: ImportRow[] = json
        .map((r) => {
          const skills = pick(r, ["skill"]);
          return {
            full_name: pick(r, ["name", "fullname", "candidate"]),
            email: pick(r, ["email", "mail"]) || null,
            phone: pick(r, ["phone", "mobile", "tel"]) || null,
            skills: skills
              ? skills.split(/[,;|]/).map((s) => s.trim()).filter(Boolean)
              : [],
          };
        })
        .filter((r) => r.full_name);
      setRows(parsed);
      if (parsed.length === 0) {
        toast.error("No rows with a name found. Add a 'Name' column header.");
      }
    } catch {
      toast.error("Couldn't read that file. Use .xlsx or .csv.");
      setRows([]);
    } finally {
      setParsing(false);
    }
  }

  function submit() {
    startTransition(async () => {
      const res = await importCandidates(slug, rows);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(
        `Imported ${res.inserted} candidate${res.inserted === 1 ? "" : "s"}` +
          (res.skipped ? ` · skipped ${res.skipped} duplicate(s)` : "")
      );
      setRows([]);
      setFileName("");
      if (inputRef.current) inputRef.current.value = "";
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <FileSpreadsheet className="size-4" />
            Import
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import candidates</DialogTitle>
          <DialogDescription>
            Upload an Excel (.xlsx) or CSV file. Columns are matched by header:
            Name, Email, Phone, Skills.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground transition-colors hover:bg-muted/50">
            <Upload className="size-5" />
            <span>{fileName || "Choose a .xlsx or .csv file"}</span>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={onFile}
            />
          </label>

          {parsing && (
            <p className="text-sm text-muted-foreground">Reading file…</p>
          )}

          {rows.length > 0 && (
            <div className="rounded-md border bg-background p-3 text-sm">
              <p className="mb-1 font-medium">
                {rows.length} candidate{rows.length === 1 ? "" : "s"} ready
              </p>
              <p className="truncate text-muted-foreground">
                {rows.slice(0, 4).map((r) => r.full_name).join(", ")}
                {rows.length > 4 ? "…" : ""}
              </p>
            </div>
          )}

          <div className="flex justify-end">
            <Button
              disabled={pending || rows.length === 0}
              onClick={submit}
            >
              {pending ? "Importing…" : `Import ${rows.length || ""}`.trim()}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
