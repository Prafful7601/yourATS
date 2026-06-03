"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Search } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export type CandidateRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
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
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = candidates.filter((c) => {
      if (!q) return true;
      return (
        c.full_name.toLowerCase().includes(q) ||
        (c.email?.toLowerCase().includes(q) ?? false) ||
        c.skills.some((s) => s.toLowerCase().includes(q))
      );
    });
    const sorted = [...matches];
    if (sort === "name") {
      sorted.sort((a, b) => a.full_name.localeCompare(b.full_name));
    } else if (sort === "score") {
      sorted.sort((a, b) => (b.bestScore ?? -1) - (a.bestScore ?? -1));
    } else {
      sorted.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    }
    return sorted;
  }, [candidates, query, sort]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-56">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email, or skill…"
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

      <p className="mb-3 text-xs text-muted-foreground">
        {filtered.length} of {candidates.length} candidate
        {candidates.length === 1 ? "" : "s"}
      </p>

      {filtered.length === 0 ? (
        <p className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          No candidates match your search.
        </p>
      ) : (
        <div className="grid gap-3">
          {filtered.map((c) => (
            <Link
              key={c.id}
              href={`/${slug}/candidates/${c.id}`}
              className="flex items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50"
            >
              <Avatar className="size-9">
                <AvatarFallback>{initials(c.full_name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{c.full_name}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {c.email ?? c.phone ?? "No contact info"}
                </p>
              </div>
              <div className="flex items-center gap-3 text-right">
                {c.bestScore != null && (
                  <Badge variant="outline">{c.bestScore}% match</Badge>
                )}
                <div className="text-xs text-muted-foreground">
                  <p>
                    {c.appCount} application{c.appCount === 1 ? "" : "s"}
                  </p>
                  <p>
                    added{" "}
                    {formatDistanceToNow(new Date(c.created_at), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
