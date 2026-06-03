"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { deleteCandidates } from "./actions";

export type CandidateRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  designation: string | null;
  skills: string[];
  created_at: string;
  appCount: number;
  bestScore: number | null;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

type SortKey = "recent" | "score" | "name";

export function CandidatesList({
  slug,
  candidates,
}: {
  slug: string;
  candidates: CandidateRow[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = candidates.filter((c) => {
      if (!q) return true;
      return (
        c.full_name.toLowerCase().includes(q) ||
        (c.email?.toLowerCase().includes(q) ?? false) ||
        (c.designation?.toLowerCase().includes(q) ?? false) ||
        c.skills.some((s) => s.toLowerCase().includes(q))
      );
    });
    const sorted = [...matches];
    if (sort === "name") sorted.sort((a, b) => a.full_name.localeCompare(b.full_name));
    else if (sort === "score") sorted.sort((a, b) => (b.bestScore ?? -1) - (a.bestScore ?? -1));
    else sorted.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    return sorted;
  }, [candidates, query, sort]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allVisibleSelected =
    filtered.length > 0 && filtered.every((c) => selected.has(c.id));

  function toggleAll() {
    setSelected((prev) => {
      if (allVisibleSelected) {
        const next = new Set(prev);
        filtered.forEach((c) => next.delete(c.id));
        return next;
      }
      return new Set([...Array.from(prev), ...filtered.map((c) => c.id)]);
    });
  }

  function bulkDelete() {
    const ids = Array.from(selected);
    if (!ids.length) return;
    if (!confirm(`Delete ${ids.length} candidate${ids.length === 1 ? "" : "s"}? This removes their applications, notes, scorecards, and résumés.`))
      return;
    startTransition(async () => {
      const res = await deleteCandidates(slug, ids);
      if (res.error) toast.error(res.error);
      else {
        toast.success(`Deleted ${res.deleted} candidate${res.deleted === 1 ? "" : "s"}.`);
        setSelected(new Set());
        router.refresh();
      }
    });
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, role, email, or skill…"
            className="pl-9"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          aria-label="Sort candidates"
        >
          <option value="recent">Most recent</option>
          <option value="score">Best match</option>
          <option value="name">Name (A–Z)</option>
        </select>
      </div>

      {/* Bulk action bar */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            className="size-4 rounded border-input"
            checked={allVisibleSelected}
            onChange={toggleAll}
          />
          {selected.size > 0
            ? `${selected.size} selected`
            : `${filtered.length} of ${candidates.length}`}
        </label>
        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              <X className="size-4" />
              Clear
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={pending}
              onClick={bulkDelete}
            >
              <Trash2 className="size-4" />
              {pending ? "Deleting…" : `Delete ${selected.size}`}
            </Button>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          No candidates match your search.
        </p>
      ) : (
        <div className="grid gap-3">
          {filtered.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 rounded-lg border bg-card p-4"
            >
              <input
                type="checkbox"
                className="size-4 shrink-0 rounded border-input"
                checked={selected.has(c.id)}
                onChange={() => toggle(c.id)}
                aria-label={`Select ${c.full_name}`}
              />
              <Link
                href={`/${slug}/candidates/${c.id}`}
                className="flex min-w-0 flex-1 items-center gap-3 transition-opacity hover:opacity-80"
              >
                <Avatar className="size-9">
                  <AvatarFallback>{initials(c.full_name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.full_name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {c.designation ?? c.email ?? c.phone ?? "No contact info"}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-right">
                  {c.bestScore != null && (
                    <Badge variant="outline">{c.bestScore}% match</Badge>
                  )}
                  <div className="hidden text-xs text-muted-foreground sm:block">
                    <p>{c.appCount} application{c.appCount === 1 ? "" : "s"}</p>
                    <p>
                      added{" "}
                      {formatDistanceToNow(new Date(c.created_at), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
