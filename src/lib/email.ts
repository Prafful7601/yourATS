/**
 * Minimal transactional email via Resend's HTTP API.
 * Best-effort: if RESEND_API_KEY isn't set (or the call fails), it returns
 * false and callers fall back to a shareable link. Server-only.
 */
export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return false;
  const from =
    process.env.EMAIL_FROM?.trim() || "yourATS <noreply@yourats.online>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
