import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { basename, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import next from "next";
import { getSystem } from "./src/system-instance.ts";

// Stage A/B of server.mjs → Next.js migration: server.mjs gets its
// ProductionSystem + SqliteStateStore + payment provider + reservation
// expiry timer from src/system-instance.ts (getSystem). This collapses
// the boot sequence to a single source of truth and avoids drift.
//
// IMPORTANT: server.mjs (Node tsx) and Next.js Route Handlers (Turbopack
// bundle) load src/system-instance.ts in DIFFERENT module graphs — they
// do NOT share this singleton. Calling getSystem() from a Route Handler
// constructs a SECOND SqliteStateStore on the same file, which races on
// writes. Therefore Route Handlers must proxy state-touching operations
// back to server.mjs over fetch (Phase 3/5/7 pattern), not import
// getSystem() directly. See system-instance.ts for the full note.
const _bootstrap = getSystem();
const system = _bootstrap.system;
const documentStorageDir = _bootstrap.documentStorageDir;
const sessionSecret = _bootstrap.sessionSecret;
const production = _bootstrap.production;
const dbFile = _bootstrap.dbFile;

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT || 4174);
const publicDir = join(__dirname, "public");
const nextDev = process.env.NEXT_DEV ? process.env.NEXT_DEV !== "false" : !production;
const nextApp = next({ dev: nextDev, dir: __dirname });
const nextHandler = nextApp.getRequestHandler();
const appRoutes = new Set([
  "/",
  "/paciente",
  "/equipe",
  "/equipe/pacientes",
  "/equipe/estoque",
  "/equipe/pedidos",
  "/equipe/fulfillment",
  "/equipe/suporte",
  "/admin",
  // Phase 3 bridge: Next.js Route Handlers under app/api/* are delegated by
  // listing their pathnames here. server.mjs adds NO new endpoint code; the
  // implementation lives in app/api/<name>/route.js.
  "/api/team/activity",
  // Stage C slice 1 — /health migrated to app/health/route.js (URL stays
  // /health to keep deployment-check / smoke / domain-tls scripts working).
  "/health",
  // Stage 2 slice (b) — /api/session GET and /api/logout POST migrated
  // to Route Handlers. Both use the Stage 1 shared globalThis singleton,
  // so they read/mutate the SAME ProductionSystem instance server.mjs sees.
  "/api/session",
  "/api/logout",
  "/api/patient/login",
  "/api/team/login",
  "/api/team/me/password",
  "/api/catalog",
  "/api/my-orders",
  "/api/checkout",
  "/api/webhooks/pix",
  "/api/patient/access-recovery",
  "/api/patient/consent",
  "/api/support-requests",
  "/api/team/dashboard",
  "/api/team/inventory-ledger",
  "/api/team/product-meta",
  "/api/team/users",
  "/api/team/users/status",
  "/api/team/users/password",
  "/api/team/stock",
  "/api/team/cultivation-batches",
  "/api/team/cultivation-batches/advance",
  "/api/team/cultivation-batches/harvest",
  "/api/team/cultivation-batches/dry",
  "/api/team/cultivation-batches/stock",
  "/api/team/patients",
  "/api/team/patient-access",
  "/api/team/patient-invite-reset",
  "/api/team/member-cards",
  "/api/team/products",
  "/api/team/products/update",
  "/api/team/fulfillment",
  "/api/team/orders/cancel",
  "/api/team/orders/exception",
  "/api/team/shipments",
  "/api/team/support-requests",
  "/api/team/payments/reconcile",
  "/api/team/simulate-pix",
  "/api/team/readiness",
  "/api/team/readiness/provider-approval",
  "/api/team/readiness/backup-schedule",
  // Phase 7 bridge: support workbench Route Handlers proxy back into
  // server.mjs's raw system calls (/api/team/support-replies/_raw,
  // /api/team/support-thread/_raw) which are NOT allow-listed and stay
  // on the legacy switch below. Handlers live in
  // app/api/team/support-replies/route.js and
  // app/api/team/support-thread/route.js.
  "/api/team/support-replies",
  "/api/team/support-thread",
  // Phase 5 bridge: fulfillment kanban drag posts here. The Route Handler
  // in app/api/team/orders/status/route.js validates the body and proxies
  // to /api/team/orders/status-apply below, which wires the shared
  // ProductionSystem singleton + the new updateOrderFulfillmentStatus
  // method (kanban-specific audit envelope).
  "/api/team/orders/status",
]);
const protectedAppRoutes = new Set([
  "/equipe/pacientes",
  "/equipe/estoque",
  "/equipe/pedidos",
  "/equipe/fulfillment",
  "/equipe/suporte",
  "/admin",
]);
// system, paymentProvider, store, reservation-expiry timer, and team-user
// seeding live in src/system-instance.ts and were initialized via
// getSystem() at the top of this file. Do not duplicate that work here.

await nextApp.prepare();

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    system.expireReservations();

    if (url.pathname.startsWith("/public/")) {
      return serveFile(response, join(publicDir, url.pathname.replace("/public/", "")));
    }
    if (url.pathname.startsWith("/_next/") || appRoutes.has(url.pathname)) {
      setSecurityHeaders(response);
      if (protectedAppRoutes.has(url.pathname)) {
        const session = system.getSession(readCookie(request, "av_session"));
        if (session?.role !== "team") return redirect(response, "/equipe");
      }
      return nextHandler(request, response);
    }

    if (url.pathname === "/api/team/prescription-documents" && request.method === "POST") {
      assertSameOrigin(request);
      const payload = await body(request);
      return json(
        response,
        201,
        system.registerPrescriptionDocument(
          readCookie(request, "av_session"),
          await storePrescriptionPayload(payload),
        ),
      );
    }
    const prescriptionDownloadMatch = url.pathname.match(
      /^\/api\/team\/prescription-documents\/([^/]+)\/download$/,
    );
    if (prescriptionDownloadMatch && request.method === "GET") {
      const documentRecord = system.getPrescriptionDocumentForDownload(
        readCookie(request, "av_session"),
        prescriptionDownloadMatch[1],
      );
      return servePrivateDocument(response, documentRecord);
    }
    return json(response, 404, { error: "Rota nao encontrada." });
  } catch (error) {
    return json(response, error.status || 500, { error: error.message || "Erro interno." });
  }
});

server.listen(port, () => {
  console.log(`Associacao Verde app: http://127.0.0.1:${port}/`);
  console.log(`SQLite database: ${dbFile}`);
});

function readCookie(request, name) {
  const header = request.headers.cookie || "";
  const match = header
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`));
  return match ? verifyCookie(decodeURIComponent(match.slice(name.length + 1))) : "";
}

async function body(request) {
  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 7_000_000) throw httpError(413, "Corpo da requisicao excede o limite.");
  }
  return raw ? JSON.parse(raw) : {};
}

async function storePrescriptionPayload(payload) {
  if (!payload.fileContentBase64) return payload;
  await mkdir(documentStorageDir, { recursive: true });
  const fileName = sanitizeFileName(payload.fileName || "receita.pdf");
  const content = Buffer.from(String(payload.fileContentBase64), "base64");
  if (!content.length) throw httpError(400, "Arquivo da receita vazio.");
  if (content.length > 5_000_000) throw httpError(413, "Arquivo da receita excede 5 MB.");
  const sha = createHash("sha256").update(content).digest("hex");
  const storedName = `${Date.now()}-${sha.slice(0, 16)}-${fileName}`;
  const filePath = join(documentStorageDir, storedName);
  await writeFile(filePath, content, { flag: "wx", mode: 0o600 });
  return {
    ...payload,
    fileContentBase64: undefined,
    storageKey: `private-documents://${storedName}`,
    privateFilePath: filePath,
    sha256: sha,
  };
}

function json(response, status, payload) {
  response.writeHead(
    status,
    securityHeaders({
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    }),
  );
  response.end(JSON.stringify(payload));
}

function redirect(response, location) {
  response.writeHead(308, securityHeaders({ Location: location, "Cache-Control": "no-store" }));
  response.end();
}

function serveFile(response, filePath) {
  const safePath = normalize(filePath);
  if (!safePath.startsWith(publicDir) || !existsSync(safePath))
    return json(response, 404, { error: "Arquivo nao encontrado." });
  const contentType =
    {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
    }[extname(safePath)] || "application/octet-stream";
  response.writeHead(
    200,
    securityHeaders({ "Content-Type": contentType, "Cache-Control": "no-store" }),
  );
  createReadStream(safePath).pipe(response);
}

async function servePrivateDocument(response, documentRecord) {
  const filePath = normalize(documentRecord.privateFilePath || "");
  const safeRoot = normalize(documentStorageDir);
  if (!filePath.startsWith(safeRoot) || !existsSync(filePath))
    return json(response, 404, { error: "Documento nao encontrado no storage privado." });
  const content = await readFile(filePath);
  const hash = createHash("sha256").update(content).digest("hex");
  if (hash !== documentRecord.sha256)
    return json(response, 409, { error: "Checksum do documento nao confere." });
  response.writeHead(
    200,
    securityHeaders({
      "Content-Type": documentRecord.mimeType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${sanitizeFileName(documentRecord.fileName)}"`,
      "Cache-Control": "no-store",
    }),
  );
  response.end(content);
}

function securityHeaders(headers = {}) {
  const base = {
    ...headers,
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "same-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy": [
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
  };
  if (production) {
    base["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
  }
  return base;
}

function setSecurityHeaders(response) {
  for (const [name, value] of Object.entries(securityHeaders({ "Cache-Control": "no-store" }))) {
    response.setHeader(name, value);
  }
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function sanitizeFileName(fileName) {
  return (
    basename(String(fileName || "documento"))
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120) || "documento"
  );
}

function verifyCookie(signed) {
  const [value, signature] = String(signed || "").split(".");
  if (!value || !signature) return "";
  const expected = createHmac("sha256", sessionSecret).update(value).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return "";
  return timingSafeEqual(actualBuffer, expectedBuffer) ? value : "";
}

function assertSameOrigin(request) {
  const origin = request.headers.origin || request.headers.referer;
  const expectedHost = request.headers.host || "";
  const proto = request.headers["x-forwarded-proto"] || "http";
  const expected = `${proto}://${expectedHost}`;
  // Accept exact origin match OR referer beginning with expected origin.
  if (origin && (origin === expected || origin.startsWith(expected + "/"))) return;
  // Same-host loopback bypass: server-to-server scripts (webhook-drill,
  // session-security, deployment-check, ...) hit internal endpoints via
  // Node fetch, which does NOT set Origin on POSTs to non-CORS targets and
  // does NOT set Referer on programmatic calls. Browsers ALWAYS send Origin
  // on cross-context POSTs, so allowing missing-Origin from loopback hosts
  // does not weaken CSRF protection for the browser-facing surface.
  if (!origin && isLoopbackHost(expectedHost)) return;
  throw httpError(403, "Origem da requisicao nao autorizada.");
}

function isLoopbackHost(hostHeader) {
  const host = String(hostHeader || "")
    .toLowerCase()
    .split(":")[0];
  return host === "127.0.0.1" || host === "localhost" || host === "[::1]" || host === "::1";
}
