import Link from "next/link";
import { KanbanSquare, Sparkles, Users } from "lucide-react";

import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    icon: KanbanSquare,
    title: "Visual pipelines",
    body: "Custom stages per job and a drag-and-drop board to move candidates through.",
  },
  {
    icon: Sparkles,
    title: "AI assistance",
    body: "Parse résumés and score candidate–job fit, with graceful fallbacks.",
  },
  {
    icon: Users,
    title: "Built for teams",
    body: "Multi-tenant workspaces, notes, and scorecards — isolated per org.",
  },
];

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-5">
        <span className="font-semibold tracking-tight">YouRats</span>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            render={<Link href="/sign-in">Sign in</Link>}
          />
          <Button size="sm" render={<Link href="/sign-up">Get started</Link>} />
        </div>
      </header>

      {/* Hero */}
      <section className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <span className="mb-5 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
          <Sparkles className="size-3.5" />
          Applicant Tracking, reimagined
        </span>
        <h1 className="max-w-2xl text-balance text-4xl font-bold tracking-tight sm:text-6xl">
          Hire better, together.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-balance text-lg text-muted-foreground">
          Post jobs, build custom pipelines, and move candidates across your
          board — with AI-assisted résumé parsing and match scoring.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button
            size="lg"
            render={<Link href="/sign-up">Get started free</Link>}
          />
          <Button
            size="lg"
            variant="outline"
            render={<Link href="/sign-in">Sign in</Link>}
          />
        </div>

        {/* Feature cards */}
        <div className="mt-16 grid w-full max-w-4xl gap-4 text-left sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border bg-card p-5">
              <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-muted text-foreground">
                <Icon className="size-5" />
              </div>
              <p className="font-medium">{title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="px-6 py-8 text-center text-xs text-muted-foreground">
        Next.js · Supabase · Tailwind · shadcn/ui
      </footer>
    </main>
  );
}
