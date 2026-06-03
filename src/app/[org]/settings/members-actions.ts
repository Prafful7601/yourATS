"use server";

import { revalidatePath } from "next/cache";

import { requireOrgMembership } from "@/lib/supabase/org";
import type { OrgRole } from "@/lib/supabase/types";

const ASSIGNABLE: OrgRole[] = ["admin", "recruiter", "viewer"];

async function guard(slug: string) {
  const ctx = await requireOrgMembership(slug);
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return { ...ctx, allowed: false as const };
  }
  return { ...ctx, allowed: true as const };
}

export async function updateMemberRole(
  slug: string,
  userId: string,
  role: OrgRole
): Promise<{ error: string | null }> {
  const ctx = await guard(slug);
  if (!ctx.allowed) return { error: "Only owners and admins can manage members." };
  if (!ASSIGNABLE.includes(role)) return { error: "Invalid role." };

  // Never change the owner's role here (org must keep an owner).
  const { data: target } = await ctx.supabase
    .from("org_members")
    .select("role")
    .eq("org_id", ctx.org.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (target?.role === "owner") return { error: "The owner's role can't be changed." };

  const { error } = await ctx.supabase
    .from("org_members")
    .update({ role })
    .eq("org_id", ctx.org.id)
    .eq("user_id", userId);
  if (error) return { error: error.message };

  revalidatePath(`/${slug}/settings`);
  return { error: null };
}

export async function removeMember(
  slug: string,
  userId: string
): Promise<{ error: string | null }> {
  const ctx = await guard(slug);
  if (!ctx.allowed) return { error: "Only owners and admins can manage members." };

  const { data: target } = await ctx.supabase
    .from("org_members")
    .select("role")
    .eq("org_id", ctx.org.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (target?.role === "owner") return { error: "You can't remove the owner." };

  const { error } = await ctx.supabase
    .from("org_members")
    .delete()
    .eq("org_id", ctx.org.id)
    .eq("user_id", userId);
  if (error) return { error: error.message };

  revalidatePath(`/${slug}/settings`);
  return { error: null };
}
