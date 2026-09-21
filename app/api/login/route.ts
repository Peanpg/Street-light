import { NextResponse } from "next/server";
import { createTeamSession, safeReturnTo, SESSION_COOKIE, sessionCookieOptions, verifyTeamCode } from "@/lib/team-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim();
  const code = String(form.get("code") ?? "");
  const returnTo = safeReturnTo(String(form.get("returnTo") ?? "/"));
  if (!name || name.length > 80 || !verifyTeamCode(code)) {
    const url = new URL("/login", request.url);
    url.searchParams.set("error", "1");
    url.searchParams.set("returnTo", returnTo);
    return NextResponse.redirect(url, { status: 303 });
  }
  const response = NextResponse.redirect(new URL(returnTo, request.url), { status: 303 });
  response.cookies.set(SESSION_COOKIE, createTeamSession(name), sessionCookieOptions);
  return response;
}
