import { NextResponse, type NextRequest } from "next/server"

import { updateSession } from "@/lib/supabase/middleware"

// Top-level paths that are NOT an organization workspace.
// /api routes do their own auth and must never be redirected.
const PUBLIC_PREFIXES = ["/auth", "/careers", "/api"]
const AUTH_PAGES = ["/sign-in", "/sign-up"]

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user, supabase } = await updateSession(request)
  const { pathname } = request.nextUrl

  const isRoot = pathname === "/"
  const isAuthPage = AUTH_PAGES.includes(pathname)
  const isOnboarding = pathname === "/onboarding"
  const isPublic =
    isRoot || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))

  // ----- Unauthenticated -----
  if (!user) {
    if (isAuthPage || isPublic) return supabaseResponse
    // Protected route (onboarding or an /[org]/* workspace) -> sign in.
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = "/sign-in"
    redirectUrl.searchParams.set("redirect", pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // ----- Authenticated -----
  // Resolve the user's first org membership (used for redirects below).
  let firstSlug: string | null = null
  if (supabase && (isAuthPage || isOnboarding || (!isPublic && !isRoot))) {
    const { data } = await supabase
      .from("org_members")
      .select("organizations(slug)")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle()
    firstSlug =
      (data?.organizations as { slug: string } | null)?.slug ?? null
  }

  // Already signed in but on an auth page -> send into the app.
  if (isAuthPage) {
    const target = firstSlug ? `/${firstSlug}/dashboard` : "/onboarding"
    return NextResponse.redirect(new URL(target, request.url))
  }

  // Signed in without any org -> must onboard first.
  if (!firstSlug && !isOnboarding && !isPublic) {
    return NextResponse.redirect(new URL("/onboarding", request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image (static assets)
     * - favicon.ico and common image/file extensions
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
