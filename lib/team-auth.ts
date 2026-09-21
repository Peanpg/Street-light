import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "pea_team_session";
const SESSION_AGE_SECONDS = 60 * 60 * 24 * 14;

type Session = { name: string; expires: number };

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  return value;
}

function signature(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function verifyTeamCode(input: string): boolean {
  const expected = process.env.TEAM_ACCESS_CODE;
  if (!expected || expected.length < 12) throw new Error("TEAM_ACCESS_CODE must be at least 12 characters");
  const left = createHash("sha256").update(input).digest();
  const right = createHash("sha256").update(expected).digest();
  return timingSafeEqual(left, right);
}

export function createTeamSession(name: string): string {
  const payload = Buffer.from(JSON.stringify({ name, expires: Date.now() + SESSION_AGE_SECONDS * 1000 } satisfies Session)).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function verifyTeamSession(token: string | undefined): Session | null {
  if (!token) return null;
  const [payload, supplied, extra] = token.split(".");
  if (!payload || !supplied || extra) return null;
  const left = Buffer.from(supplied);
  const right = Buffer.from(signature(payload));
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Session;
    return typeof value.name === "string" && value.name.length > 0 && value.name.length <= 80 && typeof value.expires === "number" && value.expires > Date.now() ? value : null;
  } catch { return null; }
}

export async function getTeamUser(): Promise<Session | null> {
  return verifyTeamSession((await cookies()).get(SESSION_COOKIE)?.value);
}

export function safeReturnTo(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const url = new URL(value, "https://app.local");
    if (url.origin !== "https://app.local" || url.pathname.startsWith("/login") || url.pathname.startsWith("/api/")) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return "/"; }
}

export const sessionCookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: SESSION_AGE_SECONDS };
