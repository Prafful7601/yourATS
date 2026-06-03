import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { matchScore, parseResume, extractSkillSet } from "@/lib/ai";

/**
 * Single entry point for AI features: POST /api/ai/<action>.
 * Requires an authenticated session. Always returns JSON; the underlying
 * helpers fall back to deterministic logic when Hugging Face is unavailable.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { action: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Cap input size to keep AI calls bounded (abuse / cost / timeout guard).
  const MAX = 50_000;
  const text = (typeof body.text === "string" ? body.text : "").slice(0, MAX);
  const jobText = (typeof body.jobText === "string" ? body.jobText : "").slice(
    0,
    MAX
  );

  try {
    switch (params.action) {
      case "parse-resume": {
        if (!text.trim())
          return NextResponse.json({ error: "text is required" }, { status: 400 });
        return NextResponse.json(await parseResume(text));
      }
      case "extract-skills": {
        if (!text.trim())
          return NextResponse.json({ error: "text is required" }, { status: 400 });
        return NextResponse.json(await extractSkillSet(text));
      }
      case "match-score": {
        return NextResponse.json(await matchScore(text, jobText));
      }
      default:
        return NextResponse.json(
          { error: `Unknown action: ${params.action}` },
          { status: 404 }
        );
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AI request failed" },
      { status: 500 }
    );
  }
}
