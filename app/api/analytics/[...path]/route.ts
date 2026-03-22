import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

/** Allow slow analytics queries in production (Vercel default is often 10s). */
export const maxDuration = 60;

const UPSTREAM_TIMEOUT_MS = 55_000;

function responseLooksLikeHtml(contentType: string | null, body: string): boolean {
  const ct = (contentType ?? "").toLowerCase();
  if (ct.includes("text/html")) return true;
  const t = body.slice(0, 200).trim();
  return /^<!DOCTYPE\s/i.test(t) || /^<\s*html[\s>]/i.test(t);
}

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
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    const detail = err instanceof Error ? err.message : String(err);
    if (name === "AbortError" || /aborted|timeout/i.test(detail)) {
      return NextResponse.json(
        {
          error: "Analytics upstream timeout",
          detail: `No response from data service within ${UPSTREAM_TIMEOUT_MS / 1000}s. Try a shorter date range, or increase nginx/ALB and data_service worker timeouts.`,
        },
        { status: 504 }
      );
    }
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

  // Gateways often return 502/503 with an HTML page — don't forward HTML to the client.
  if (!upstream.ok && responseLooksLikeHtml(upstream.headers.get("content-type"), text)) {
    return NextResponse.json(
      {
        error: "Analytics upstream error",
        detail: `The data service or a proxy returned ${upstream.status} with an HTML error page (not JSON). Check that data_service is running, DATA_SERVICE_URL is correct and reachable from this app, firewall rules, and proxy timeouts.`,
      },
      { status: upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502 }
    );
  }

  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": contentType },
  });
}
