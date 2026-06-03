import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage({
  params,
}: {
  params: { org: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  // Confirm membership of this org and read its name.
  const { data: membership } = await supabase
    .from("org_members")
    .select("organizations!inner(name, slug)")
    .eq("user_id", user.id)
    .eq("organizations.slug", params.org)
    .maybeSingle();

  if (!membership) redirect("/sign-in");

  const org = membership.organizations as unknown as {
    name: string;
    slug: string;
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold tracking-tight">
        Welcome to {org.name}
      </h1>
      <p className="mt-2 text-muted-foreground">
        Your dashboard is ready. Jobs, candidates, and your pipeline will live
        here.
      </p>
    </div>
  );
}
