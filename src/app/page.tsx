import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 text-center">
      <div className="space-y-4">
        <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
          YouRats
        </p>
        <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
          Hire better, together.
        </h1>
        <p className="mx-auto max-w-xl text-balance text-muted-foreground">
          A multi-tenant applicant tracking system. Post jobs, build custom
          pipelines, and move candidates across your board — with AI-assisted
          resume parsing and match scoring.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button render={<Link href="/signup">Get started</Link>} />
        <Button
          variant="outline"
          render={<Link href="/login">Sign in</Link>}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Day 1 scaffold · Next.js 14 · Supabase · Tailwind v4 · shadcn/ui
      </p>
    </main>
  );
}
