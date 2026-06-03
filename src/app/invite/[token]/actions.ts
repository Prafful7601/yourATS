"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function acceptInvite(formData: FormData) {
  const token = String(formData.get("token") ?? "");

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?redirect=/invite/${token}`);

  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("org_invitations")
    .select("id, org_id, email, role, accepted_at, expires_at")
    .eq("id", token)
    .maybeSingle();

  if (!invite || invite.accepted_at) return;
  if (new Date(invite.expires_at) < new Date()) return;
  if (invite.email.toLowerCase() !== (user.email ?? "").toLowerCase()) return;

  // Create membership (idempotent: ignore if already a member).
  const { error } = await admin.from("org_members").upsert(
    { org_id: invite.org_id, user_id: user.id, role: invite.role },
    { onConflict: "org_id,user_id" }
  );
  if (error) return;

  await admin
    .from("org_invitations")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  const { data: org } = await admin
    .from("organizations")
    .select("slug")
    .eq("id", invite.org_id)
    .maybeSingle();

  redirect(org ? `/${org.slug}/dashboard` : "/");
}
