// Stage B of server.mjs → Next.js migration: Next.js-level security
// response headers. Mirrors server.mjs::securityHeaders() so Route Handlers
// and pages emit the same X-Content-Type-Options / X-Frame-Options /
// Referrer-Policy / Permissions-Policy / CSP / HSTS (production) headers
// that the legacy server emits.
//
// server.mjs::setSecurityHeaders stays for now — defense-in-depth covers
// requests that legacy switch handles, and Next overrides for handlers it
// owns.

const production = process.env.NODE_ENV === "production";

const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "img-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

if (production) {
  SECURITY_HEADERS.push({
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  });
}

const nextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
