import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-10">
      <Link href="/" className="flex items-center gap-2">
        <span className="text-lg font-semibold tracking-tight">YouRats</span>
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
