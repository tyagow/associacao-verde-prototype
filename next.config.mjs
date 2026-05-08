// Next.js-level security response headers. Route Handlers and pages emit
// X-Content-Type-Options / X-Frame-Options / Referrer-Policy /
// Permissions-Policy / CSP / HSTS (production-only) on every response.

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
  // Backwards-compat: legacy code may reference /public/<asset>; rewrite to
  // the Next.js convention (public/<asset> served at /<asset>) so existing
  // links keep working without churn while we migrate references.
  async rewrites() {
    return [{ source: "/public/:path*", destination: "/:path*" }];
  },
};

export default nextConfig;
