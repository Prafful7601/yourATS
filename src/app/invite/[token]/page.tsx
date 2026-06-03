import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { acceptInvite } from "./actions";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">{children}</Card>
    </div>
  );
}

export default async function InvitePage({
  params,
}: {
  params: { token: string };
}) {
  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("org_invitations")
    .select("id, org_id, email, role, accepted_at, expires_at")
    .eq("id", params.token)
    .maybeSingle();

  const org = invite
    ? (
        await admin
          .from("organizations")
          .select("name, slug")
          .eq("id", invite.org_id)
          .maybeSingle()
      ).data
    : null;

  if (!invite || !org) {
    return (
      <Shell>
        <CardHeader>
          <CardTitle>Invitation not found</CardTitle>
          <CardDescription>
            This invite link is invalid or has been revoked.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="w-full" render={<Link href="/">Go home</Link>} />
        </CardContent>
      </Shell>
    );
  }

  if (invite.accepted_at) {
    return (
      <Shell>
        <CardHeader>
          <CardTitle>Invitation already used</CardTitle>
          <CardDescription>This invite has already been accepted.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" render={<Link href="/sign-in">Sign in</Link>} />
        </CardContent>
      </Shell>
    );
  }

  if (new Date(invite.expires_at) < new Date()) {
    return (
      <Shell>
        <CardHeader>
          <CardTitle>Invitation expired</CardTitle>
          <CardDescription>
            Ask {org.name} for a fresh invite link.
          </CardDescription>
        </CardHeader>
      </Shell>
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not signed in → prompt to authenticate, returning here afterward.
  if (!user) {
    const next = `/invite/${invite.id}`;
    return (
      <Shell>
        <CardHeader>
          <CardTitle>Join {org.name}</CardTitle>
          <CardDescription>
            You&apos;ve been invited as a {invite.role}. Sign in or create an
            account with <strong>{invite.email}</strong> to accept.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex flex-col gap-3">
          <Button
            className="w-full"
            render={
              <Link href={`/sign-up?redirect=${encodeURIComponent(next)}`}>
                Create account
              </Link>
            }
          />
          <Button
            variant="outline"
            className="w-full"
            render={
              <Link href={`/sign-in?redirect=${encodeURIComponent(next)}`}>
                Sign in
              </Link>
            }
          />
        </CardFooter>
      </Shell>
    );
  }

  // Signed in, but with a different email than the invite.
  if (invite.email.toLowerCase() !== (user.email ?? "").toLowerCase()) {
    return (
      <Shell>
        <CardHeader>
          <CardTitle>Wrong account</CardTitle>
          <CardDescription>
            This invite is for <strong>{invite.email}</strong>, but you&apos;re
            signed in as {user.email}. Sign in with the invited email to accept.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="w-full" render={<Link href="/sign-in">Switch account</Link>} />
        </CardContent>
      </Shell>
    );
  }

  return (
    <Shell>
      <CardHeader>
        <CardTitle>Join {org.name}</CardTitle>
        <CardDescription>
          You&apos;ve been invited to join as a {invite.role}.
        </CardDescription>
      </CardHeader>
      <CardFooter>
        <form action={acceptInvite} className="w-full">
          <input type="hidden" name="token" value={invite.id} />
          <Button type="submit" className="w-full">
            Accept invitation
          </Button>
        </form>
      </CardFooter>
    </Shell>
  );
}
