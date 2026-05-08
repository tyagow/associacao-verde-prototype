// Stage B of server.mjs → Next.js migration: edge middleware that mirrors
// server.mjs's two non-bypassable request-level policies for paths Next.js
// handles (Route Handlers + protected pages):
//
//  1. Same-origin enforcement on POST /api/* — denies requests whose
//     Origin/Referer doesn't match Host. Mirrors `assertSameOrigin` in
//     server.mjs (post-`05fa251` hardening: missing Origin AND Referer = 403).
//
//  2. Page protection for /equipe/* (sub-routes) and /admin — redirects
//     unauthenticated requests to /equipe (the sign-in entry). Mirrors
//     `protectedAppRoutes` in server.mjs. Cookie *presence* is enough at
//     the middleware layer; the page itself enforces the signed-cookie +
//     role check via system.getSession (defense-in-depth).
//
// server.mjs's `setSecurityHeaders` and `assertSameOrigin` STAY for now
// (defense-in-depth). For requests that Next.js handles, the headers from
// next.config.mjs::headers() take effect.
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

  // 1. Same-origin enforcement for POST /api/* (mirrors server.mjs::assertSameOrigin)
  if (method === "POST" && pathname.startsWith("/api/")) {
    const origin = request.headers.get("origin") || request.headers.get("referer") || "";
    const host = request.headers.get("host") || "";
    const proto = request.headers.get("x-forwarded-proto") || "http";
    const expected = `${proto}://${host}`;
    const allowed = origin === expected || origin.startsWith(expected + "/");
    if (!origin || !allowed) {
      return NextResponse.json(
        { error: "Origem da requisicao nao autorizada." },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    }
  }

  // 2. Protected page redirect (mirrors server.mjs::protectedAppRoutes).
  //    Cookie *presence* is enough here; the page itself re-checks signed
  //    cookie + role via system.getSession().
  if (PROTECTED_PAGE_PATHS.has(pathname)) {
    const sessionCookie = request.cookies.get("av_session");
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
