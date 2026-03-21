import { NextResponse } from "next/server";

import { timingSafeEqualString } from "@/lib/auth-constants";
import { createSessionToken, getCookieName } from "@/lib/session";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { password?: string };
  const password = typeof body.password === "string" ? body.password : "";
  const expected = process.env.EXEC_DASH_PASSWORD ?? "";
  const secret = process.env.SESSION_SECRET ?? "";

  if (!expected || !secret) {
    return NextResponse.json({ error: "Server misconfigured: EXEC_DASH_PASSWORD and SESSION_SECRET required" }, { status: 500 });
  }

  if (!timingSafeEqualString(password, expected)) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const token = await createSessionToken(secret);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(getCookieName(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
