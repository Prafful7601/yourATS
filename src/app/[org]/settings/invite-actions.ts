"use server";

import { revalidatePath } from "next/cache";

import { requireOrgMembership } from "@/lib/supabase/org";
import { sendEmail } from "@/lib/email";
import { getBaseUrl } from "@/lib/url";
import type { OrgRole } from "@/lib/supabase/types";

export type InviteState = {
  error: string | null;
  link?: string;
  emailed?: boolean;
};

const INVITABLE_ROLES: OrgRole[] = ["admin", "recruiter", "viewer"];

export async function createInvite(
  _prev: InviteState,
  formData: FormData
): Promise<InviteState> {
  const slug = String(formData.get("slug") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "recruiter") as OrgRole;

  const { supabase, org, user, role: myRole } = await requireOrgMembership(slug);
  if (myRole !== "owner" && myRole !== "admin") {
    return { error: "Only owners and admins can invite members." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address." };
  }
  const safeRole = INVITABLE_ROLES.includes(role) ? role : "recruiter";

  // Already a member?
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existingProfile) {
    const { data: member } = await supabase
      .from("org_members")
      .select("id")
      .eq("org_id", org.id)
      .eq("user_id", existingProfile.id)
      .maybeSingle();
    if (member) return { error: "That person is already a member." };
  }

  const { data: invite, error } = await supabase
    .from("org_invitations")
    .insert({ org_id: org.id, email, role: safeRole, invited_by: user.id })
    .select("id")
    .single();

  if (error || !invite) {
    if (error?.code === "23505") {
      return { error: "There's already a pending invite for that email." };
    }
    return { error: error?.message ?? "Could not create the invite." };
  }

  const link = `${getBaseUrl()}/invite/${invite.id}`;

  // Best-effort email; the UI shows the link regardless.
  const emailed = await sendEmail({
    to: email,
    subject: `You're invited to join ${org.name} on yourATS`,
    html: `<p>You've been invited to join <strong>${org.name}</strong> on yourATS as a ${safeRole}.</p>
           <p><a href="${link}">Accept your invitation</a></p>
           <p>Or paste this link into your browser:<br>${link}</p>`,
  });

  revalidatePath(`/${slug}/settings`);
  return { error: null, link, emailed };
}

export async function revokeInvite(slug: string, inviteId: string) {
  const { supabase, role } = await requireOrgMembership(slug);
  if (role !== "owner" && role !== "admin") {
    return { error: "Not allowed." };
  }
  const { error } = await supabase
    .from("org_invitations")
    .delete()
    .eq("id", inviteId);
  if (error) return { error: error.message };
  revalidatePath(`/${slug}/settings`);
  return { error: null };
}
