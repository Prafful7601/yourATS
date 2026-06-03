"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Briefcase,
  ChevronRight,
  ExternalLink,
  FileText,
  KanbanSquare,
  LayoutDashboard,
  LogOut,
  Plus,
  Settings,
  Users,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

type Job = { id: string; title: string; status: string };

type Props = {
  slug: string;
  orgName: string;
  fullName: string | null;
  email: string;
  jobs: Job[];
};

function initials(name: string | null, email: string) {
  const base = (name ?? email).trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

/** A leaf navigation link. */
function NavLink({
  href,
  icon: Icon,
  label,
  active,
  depth = 0,
}: {
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  depth?: number;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-md py-2 pr-2 text-sm transition-colors",
        depth === 0 ? "pl-3 font-medium" : "pl-9 text-[13px]",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
      )}
    >
      {Icon && <Icon className="size-4 shrink-0" />}
      <span className="truncate">{label}</span>
    </Link>
  );
}

/** A collapsible section with a chevron. */
function Section({
  icon: Icon,
  label,
  open,
  onToggle,
  active,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  open: boolean;
  onToggle: () => void;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-md py-2 pl-3 pr-2 text-sm font-medium transition-colors",
          active
            ? "text-foreground"
            : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
        )}
      >
        <Icon className="size-4 shrink-0" />
        <span className="flex-1 text-left">{label}</span>
        <ChevronRight
          className={cn(
            "size-4 shrink-0 transition-transform",
            open && "rotate-90"
          )}
        />
      </button>
      {open && <div className="mt-0.5 space-y-0.5">{children}</div>}
    </div>
  );
}

export function OrgSidebar({ slug, orgName, fullName, email, jobs }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const base = `/${slug}`;
  const onJobs = pathname.startsWith(`${base}/jobs`);
  const onCandidates = pathname.startsWith(`${base}/candidates`);

  const [jobsOpen, setJobsOpen] = useState(true);
  const [openJobs, setOpenJobs] = useState<Set<string>>(new Set());

  const isActive = (href: string) => pathname === href;
  const activeJobId = jobs.find((j) =>
    pathname.startsWith(`${base}/jobs/${j.id}`)
  )?.id;

  function toggleJob(id: string) {
    setOpenJobs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center border-b px-4">
        <Link href={`${base}/dashboard`} className="truncate font-semibold">
          {orgName}
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        <NavLink
          href={`${base}/dashboard`}
          icon={LayoutDashboard}
          label="Dashboard"
          active={isActive(`${base}/dashboard`)}
        />

        <Section
          icon={Briefcase}
          label="Jobs"
          open={jobsOpen}
          onToggle={() => setJobsOpen((o) => !o)}
          active={onJobs}
        >
          <NavLink
            href={`${base}/jobs`}
            label="All jobs"
            active={isActive(`${base}/jobs`)}
            depth={1}
          />
          <NavLink
            href={`${base}/jobs/new`}
            icon={Plus}
            label="New job"
            active={isActive(`${base}/jobs/new`)}
            depth={1}
          />

          {jobs.length > 0 && (
            <div className="my-1 ml-9 border-t" />
          )}

          {jobs.map((job) => {
            const jobBase = `${base}/jobs/${job.id}`;
            const expanded = openJobs.has(job.id) || activeJobId === job.id;
            return (
              <div key={job.id}>
                <button
                  type="button"
                  onClick={() => toggleJob(job.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md py-1.5 pl-9 pr-2 text-[13px] transition-colors",
                    activeJobId === job.id
                      ? "text-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
                  )}
                >
                  <ChevronRight
                    className={cn(
                      "size-3.5 shrink-0 transition-transform",
                      expanded && "rotate-90"
                    )}
                  />
                  <span className="truncate">{job.title}</span>
                </button>
                {expanded && (
                  <div className="space-y-0.5">
                    <Link
                      href={jobBase}
                      className={cn(
                        "flex items-center gap-2 rounded-md py-1.5 pl-[3.25rem] pr-2 text-[13px] transition-colors",
                        isActive(jobBase)
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
                      )}
                    >
                      <FileText className="size-3.5 shrink-0" />
                      Overview
                    </Link>
                    <Link
                      href={`${jobBase}/board`}
                      className={cn(
                        "flex items-center gap-2 rounded-md py-1.5 pl-[3.25rem] pr-2 text-[13px] transition-colors",
                        pathname.startsWith(`${jobBase}/board`)
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
                      )}
                    >
                      <KanbanSquare className="size-3.5 shrink-0" />
                      Pipeline board
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </Section>

        <NavLink
          href={`${base}/candidates`}
          icon={Users}
          label="Candidates"
          active={onCandidates}
        />

        <NavLink
          href={`${base}/settings`}
          icon={Settings}
          label="Settings"
          active={isActive(`${base}/settings`)}
        />

        <div className="my-1 border-t" />

        <a
          href={`/careers/${slug}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2.5 rounded-md py-2 pl-3 pr-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent/50 hover:text-foreground"
        >
          <ExternalLink className="size-4 shrink-0" />
          <span className="flex-1">Careers page</span>
        </a>
      </nav>

      <div className="border-t p-3">
        <div className="flex items-center gap-3">
          <Avatar className="size-8">
            <AvatarFallback>{initials(fullName, email)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {fullName ?? "Account"}
            </p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          </div>
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={signOut}
            aria-label="Sign out"
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
