import { headers } from "next/headers";

/**
 * Absolute base URL for building links (e.g. invite links) in server code.
 * Prefers the real request host (so links match the domain the user is on,
 * like yourats.online), falling back to NEXT_PUBLIC_APP_URL.
 */
export function getBaseUrl(): string {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) {
    const proto =
      h.get("x-forwarded-proto") ??
      (host.startsWith("localhost") || host.startsWith("127.0.0.1")
        ? "http"
        : "https");
    return `${proto}://${host}`;
  }
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
}
