import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-10">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <Link href="/" className="flex items-center gap-2">
        <span className="text-lg font-semibold tracking-tight">yourATS</span>
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
