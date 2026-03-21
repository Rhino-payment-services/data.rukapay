import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "SESSION_SECRET not configured" }, { status: 500 });
  }

  const cookie = (await cookies()).get("exec_session")?.value;
  if (!cookie) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await jwtVerify(cookie, new TextEncoder().encode(secret));
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const base = process.env.DATA_SERVICE_URL;
  if (!base) {
    return NextResponse.json({ error: "DATA_SERVICE_URL not configured" }, { status: 500 });
  }

  const segments = (await context.params).path;
  const path = segments.join("/");
  const search = request.nextUrl.search;
  const url = `${base.replace(/\/$/, "")}/analytics/${path}${search}`;

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error: "Data service unreachable",
        detail: `Could not reach ${base}. ${detail}`,
      },
      { status: 502 }
    );
  }

  const text = await upstream.text();
  const contentType = upstream.headers.get("content-type") ?? "application/json";

  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": contentType },
  });
}
