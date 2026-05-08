// Edge middleware: the two non-bypassable request-level policies for paths
// Next.js handles (Route Handlers + protected pages):
//
//  1. Same-origin enforcement on POST /api/* — denies requests whose
//     Origin/Referer doesn't match Host. Missing Origin AND Referer = 403,
//     except for same-host loopback (server-to-server readiness scripts).
//
//  2. Page protection for /equipe/* (sub-routes) and /admin — redirects
//     unauthenticated requests to /equipe (the sign-in entry). Cookie
//     *presence* is enough at the middleware layer; the page itself
//     enforces the signed-cookie + role check via system.getSession
//     (defense-in-depth).
//
// Security response headers (CSP, HSTS, X-Frame-Options, ...) live in
// next.config.mjs::headers() and are returned on every response.
//
// Note: this file uses .ts extension because Next.js looks for middleware.ts
// before middleware.js, but we keep it free of TS-only syntax so the
// existing ESLint config (no @typescript-eslint parser) accepts it.

import { NextResponse } from "next/server";

const PROTECTED_PAGE_PATHS = new Set([
  "/equipe/pacientes",
  "/equipe/estoque",
  "/equipe/pedidos",
  "/equipe/fulfillment",
  "/equipe/suporte",
  "/admin",
]);

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const method = request.method.toUpperCase();

  // 1a. Webhook endpoints are exempt from same-origin (provider posts cross-origin).
  //     Authenticity is enforced inside the handler via timingSafeEqual on the
  //     shared X-Webhook-Secret header — see app/api/webhooks/pix/route.js.
  if (method === "POST" && pathname.startsWith("/api/webhooks/")) {
    return NextResponse.next();
  }

  // 1. Same-origin enforcement for POST /api/*.
  //    Allows missing Origin/Referer ONLY when the host header is a same-host
  //    loopback (127.0.0.1:* / localhost:*), which is how Node fetch from
  //    server-to-server readiness scripts reaches the app. Browsers always
  //    send Origin on cross-context POSTs, so this does not weaken CSRF.
  if (method === "POST" && pathname.startsWith("/api/")) {
    const origin = request.headers.get("origin") || request.headers.get("referer") || "";
    const host = request.headers.get("host") || "";
    const proto = request.headers.get("x-forwarded-proto") || "http";
    const expected = `${proto}://${host}`;
    const allowed = origin === expected || origin.startsWith(expected + "/");
    const hostOnly = host.toLowerCase().split(":")[0];
    const isLoopback =
      hostOnly === "127.0.0.1" ||
      hostOnly === "localhost" ||
      hostOnly === "[::1]" ||
      hostOnly === "::1";
    if (origin && !allowed) {
      return NextResponse.json(
        { error: "Origem da requisicao nao autorizada." },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (!origin && !isLoopback) {
      return NextResponse.json(
        { error: "Origem da requisicao nao autorizada." },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    }
  }

  // 2. Protected page redirect.
  //    Cookie *presence* is enough here; the page itself re-checks signed
  //    cookie + role via system.getSession().
  if (PROTECTED_PAGE_PATHS.has(pathname)) {
    // Edge runtime: no getSystem() — read env directly. Mirrors
    // sessionCookieName() in src/route-helpers.ts: production uses the
    // `__Host-` prefix, dev keeps the plain name.
    const cookieName =
      process.env.AV_REQUIRE_LIVE_PROVIDER === "true" ? "__Host-av_session" : "av_session";
    const sessionCookie = request.cookies.get(cookieName);
    if (!sessionCookie || !sessionCookie.value) {
      const redirectUrl = new URL("/equipe", request.url);
      return NextResponse.redirect(redirectUrl, 308);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*", "/equipe/:path*", "/admin/:path*"],
};
