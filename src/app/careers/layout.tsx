import Link from "next/link";

export default function CareersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1">{children}</main>
      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        Powered by{" "}
        <Link href="/" className="font-medium hover:underline">
          YouRats
        </Link>
      </footer>
    </div>
  );
}
