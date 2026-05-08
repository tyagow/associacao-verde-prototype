import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { basename, dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import next from "next";
import { evaluateReleaseGate } from "./src/release-gate.ts";
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
const paymentProvider = _bootstrap.paymentProvider;
const documentStorageDir = _bootstrap.documentStorageDir;
const readinessDir = _bootstrap.readinessDir;
const webhookSecret = _bootstrap.webhookSecret;
const sessionSecret = _bootstrap.sessionSecret;
const production = _bootstrap.production;
const dbFile = _bootstrap.dbFile;

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT || 4174);
const publicDir = join(__dirname, "public");
const backupDrillEvidenceFile = join(
  __dirname,
  "artifacts",
  "readiness",
  "backup-restore-drill.json",
);
const webhookDrillEvidenceFile = join(__dirname, "artifacts", "readiness", "webhook-drill.json");
const providerApprovalEvidenceFile = join(
  __dirname,
  "artifacts",
  "readiness",
  "provider-approval.json",
);
const deploymentEvidenceFile = join(__dirname, "artifacts", "readiness", "deployment-check.json");
const backupScheduleEvidenceFile = join(
  __dirname,
  "artifacts",
  "readiness",
  "backup-schedule.json",
);
const domainTlsEvidenceFile = join(__dirname, "artifacts", "readiness", "domain-tls.json");
const schemaCheckEvidenceFile = join(__dirname, "artifacts", "readiness", "schema-check.json");
const sessionSecurityEvidenceFile = join(
  __dirname,
  "artifacts",
  "readiness",
  "session-security.json",
);
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
const loginAttempts = new Map();
// system, paymentProvider, store, reservation-expiry timer, and team-user
// seeding now live in src/system-instance.ts and were initialized at the
// top of this file via getSystem(). Do not duplicate that work here.

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

    if (url.pathname === "/api/session" && request.method === "GET") {
      return json(response, 200, { session: system.getSession(readCookie(request, "av_session")) });
    }
    if (url.pathname === "/api/patient/login" && request.method === "POST") {
      assertSameOrigin(request);
      const payload = await body(request);
      const key = loginAttemptKey(request, "patient", payload.memberCode);
      assertLoginAllowed(key);
      let result;
      try {
        result = system.loginPatient(payload);
        clearLoginAttempts(key);
      } catch (error) {
        recordLoginFailure(key);
        throw error;
      }
      setSessionCookie(response, result.sessionId);
      return json(response, 200, { patient: result.patient });
    }
    if (url.pathname === "/api/patient/access-recovery" && request.method === "POST") {
      assertSameOrigin(request);
      return json(response, 201, {
        ticket: system.createAccessRecoveryRequest(await body(request)),
      });
    }
    if (url.pathname === "/api/team/login" && request.method === "POST") {
      assertSameOrigin(request);
      const payload = await body(request);
      const key = loginAttemptKey(request, "team", payload.email);
      assertLoginAllowed(key);
      let result;
      try {
        result = system.loginTeam(payload);
        clearLoginAttempts(key);
      } catch (error) {
        recordLoginFailure(key);
        throw error;
      }
      setSessionCookie(response, result.sessionId);
      return json(response, 200, { ok: true });
    }
    if (url.pathname === "/api/logout" && request.method === "POST") {
      assertSameOrigin(request);
      system.logout(readCookie(request, "av_session"));
      response.setHeader("Set-Cookie", cookie("av_session", "", { maxAge: 0 }));
      return json(response, 200, { ok: true });
    }
    if (url.pathname === "/api/catalog" && request.method === "GET") {
      return json(response, 200, {
        products: system.listCatalog(readCookie(request, "av_session")),
      });
    }
    if (url.pathname === "/api/patient/consent" && request.method === "POST") {
      assertSameOrigin(request);
      return json(response, 200, {
        patient: system.acceptPrivacyConsent(
          readCookie(request, "av_session"),
          await body(request),
        ),
      });
    }
    if (url.pathname === "/api/checkout" && request.method === "POST") {
      assertSameOrigin(request);
      return json(
        response,
        201,
        await system.createCheckout(readCookie(request, "av_session"), await body(request)),
      );
    }
    if (url.pathname === "/api/my-orders" && request.method === "GET") {
      return json(response, 200, {
        orders: system.listMyOrders(readCookie(request, "av_session")),
      });
    }
    if (url.pathname === "/api/support-requests" && request.method === "POST") {
      assertSameOrigin(request);
      return json(response, 201, {
        ticket: system.createSupportRequest(readCookie(request, "av_session"), await body(request)),
      });
    }
    if (url.pathname === "/api/team/dashboard" && request.method === "GET") {
      return json(response, 200, system.dashboard(readCookie(request, "av_session")));
    }
    if (url.pathname === "/api/team/inventory-ledger" && request.method === "GET") {
      return json(response, 200, system.listProductLots(readCookie(request, "av_session")));
    }
    if (url.pathname === "/api/team/product-meta" && request.method === "POST") {
      assertSameOrigin(request);
      return json(response, 200, {
        product: system.updateProductMeta(readCookie(request, "av_session"), await body(request)),
      });
    }
    if (url.pathname === "/api/team/readiness" && request.method === "GET") {
      system.requireTeam(readCookie(request, "av_session"), "dashboard:view");
      return json(response, 200, readinessReport());
    }
    if (url.pathname === "/api/team/readiness/provider-approval" && request.method === "POST") {
      assertSameOrigin(request);
      return json(response, 200, {
        providerApproval: await writeProviderApprovalEvidence(
          readCookie(request, "av_session"),
          await body(request),
        ),
      });
    }
    if (url.pathname === "/api/team/readiness/backup-schedule" && request.method === "POST") {
      assertSameOrigin(request);
      return json(response, 200, {
        backupSchedule: await writeBackupScheduleEvidence(
          readCookie(request, "av_session"),
          await body(request),
        ),
      });
    }
    if (url.pathname === "/api/team/users" && request.method === "POST") {
      assertSameOrigin(request);
      return json(response, 201, {
        user: system.createTeamUser(readCookie(request, "av_session"), await body(request)),
      });
    }
    if (url.pathname === "/api/team/users/status" && request.method === "POST") {
      assertSameOrigin(request);
      return json(response, 200, {
        user: system.updateTeamUserStatus(readCookie(request, "av_session"), await body(request)),
      });
    }
    if (url.pathname === "/api/team/users/password" && request.method === "POST") {
      assertSameOrigin(request);
      return json(response, 200, {
        user: system.resetTeamUserPassword(readCookie(request, "av_session"), await body(request)),
      });
    }
    if (url.pathname === "/api/team/me/password" && request.method === "POST") {
      assertSameOrigin(request);
      return json(response, 200, {
        user: system.changeOwnTeamPassword(readCookie(request, "av_session"), await body(request)),
      });
    }
    if (url.pathname === "/api/team/stock" && request.method === "POST") {
      assertSameOrigin(request);
      return json(response, 200, {
        product: system.addStock(readCookie(request, "av_session"), await body(request)),
      });
    }
    if (url.pathname === "/api/team/cultivation-batches" && request.method === "POST") {
      assertSameOrigin(request);
      return json(response, 201, {
        batch: system.createCultivationBatch(
          readCookie(request, "av_session"),
          await body(request),
        ),
      });
    }
    if (url.pathname === "/api/team/cultivation-batches/advance" && request.method === "POST") {
      assertSameOrigin(request);
      return json(response, 200, {
        batch: system.advanceCultivationBatch(
          readCookie(request, "av_session"),
          await body(request),
        ),
      });
    }
    if (url.pathname === "/api/team/cultivation-batches/harvest" && request.method === "POST") {
      assertSameOrigin(request);
      return json(response, 200, {
        batch: system.recordHarvest(readCookie(request, "av_session"), await body(request)),
      });
    }
    if (url.pathname === "/api/team/cultivation-batches/dry" && request.method === "POST") {
      assertSameOrigin(request);
      return json(response, 200, {
        batch: system.recordDryWeight(readCookie(request, "av_session"), await body(request)),
      });
    }
    if (url.pathname === "/api/team/cultivation-batches/stock" && request.method === "POST") {
      assertSameOrigin(request);
      return json(
        response,
        200,
        system.moveBatchToStock(readCookie(request, "av_session"), await body(request)),
      );
    }
    if (url.pathname === "/api/team/patients" && request.method === "POST") {
      assertSameOrigin(request);
      return json(response, 201, {
        patient: system.createPatient(readCookie(request, "av_session"), await body(request)),
      });
    }
    if (url.pathname === "/api/team/patient-access" && request.method === "POST") {
      assertSameOrigin(request);
      return json(
        response,
        200,
        system.updatePatientAccess(readCookie(request, "av_session"), await body(request)),
      );
    }
    if (url.pathname === "/api/team/patient-invite-reset" && request.method === "POST") {
      assertSameOrigin(request);
      return json(
        response,
        200,
        system.resetPatientInvite(readCookie(request, "av_session"), await body(request)),
      );
    }
    if (url.pathname === "/api/team/member-cards" && request.method === "POST") {
      assertSameOrigin(request);
      return json(
        response,
        201,
        system.issueMemberCard(readCookie(request, "av_session"), await body(request)),
      );
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
    if (url.pathname === "/api/team/products" && request.method === "POST") {
      assertSameOrigin(request);
      return json(response, 201, {
        product: system.createProduct(readCookie(request, "av_session"), await body(request)),
      });
    }
    if (url.pathname === "/api/team/products/update" && request.method === "POST") {
      assertSameOrigin(request);
      return json(response, 200, {
        product: system.updateProduct(readCookie(request, "av_session"), await body(request)),
      });
    }
    if (url.pathname === "/api/team/fulfillment" && request.method === "POST") {
      assertSameOrigin(request);
      return json(response, 200, {
        order: system.updateFulfillmentStatus(
          readCookie(request, "av_session"),
          await body(request),
        ),
      });
    }
    if (url.pathname === "/api/team/orders/cancel" && request.method === "POST") {
      assertSameOrigin(request);
      return json(response, 200, {
        order: system.cancelOrder(readCookie(request, "av_session"), await body(request)),
      });
    }
    // Phase 5 bridge target: the public path /api/team/orders/status is a
    // Next Route Handler (allow-listed above). It proxies here to wire the
    // shared ProductionSystem singleton to the new kanban-aware
    // updateOrderFulfillmentStatus method (team_order_status_changed audit).
    if (url.pathname === "/api/team/orders/status-apply" && request.method === "POST") {
      assertSameOrigin(request);
      return json(response, 200, {
        order: system.updateOrderFulfillmentStatus(
          readCookie(request, "av_session"),
          await body(request),
        ),
      });
    }
    if (url.pathname === "/api/team/orders/exception" && request.method === "POST") {
      assertSameOrigin(request);
      return json(response, 200, {
        order: system.recordOrderException(readCookie(request, "av_session"), await body(request)),
      });
    }
    if (url.pathname === "/api/team/shipments" && request.method === "POST") {
      assertSameOrigin(request);
      return json(
        response,
        200,
        system.upsertShipment(readCookie(request, "av_session"), await body(request)),
      );
    }
    if (url.pathname === "/api/team/support-requests" && request.method === "POST") {
      assertSameOrigin(request);
      return json(response, 200, {
        ticket: system.updateSupportRequest(readCookie(request, "av_session"), await body(request)),
      });
    }
    // Phase 7 — raw system access for the Route Handlers under
    // app/api/team/support-{replies,thread}/route.js. These paths are NOT
    // in `appRoutes`; they stay on this switch so the Route Handlers can
    // proxy via fetch with the session cookie forwarded.
    if (url.pathname === "/api/team/support-replies/_raw" && request.method === "POST") {
      assertSameOrigin(request);
      return json(response, 201, {
        message: system.createSupportReply(readCookie(request, "av_session"), await body(request)),
      });
    }
    if (url.pathname === "/api/team/support-thread/_raw" && request.method === "GET") {
      const ticketId = url.searchParams.get("ticketId") || "";
      return json(
        response,
        200,
        system.listSupportThread(readCookie(request, "av_session"), ticketId),
      );
    }
    if (url.pathname === "/api/team/payments/reconcile" && request.method === "POST") {
      assertSameOrigin(request);
      return json(
        response,
        200,
        await system.reconcilePayment(readCookie(request, "av_session"), await body(request)),
      );
    }
    if (url.pathname === "/api/webhooks/pix" && request.method === "POST") {
      const provided = String(request.headers["x-webhook-secret"] || "");
      const expected = String(webhookSecret || "");
      const a = Buffer.from(provided);
      const b = Buffer.from(expected);
      if (a.length !== b.length || !timingSafeEqual(a, b))
        throw httpError(401, "Webhook Pix sem assinatura valida.");
      return json(
        response,
        200,
        system.confirmPixPayment(normalizePixWebhook(await body(request))),
      );
    }
    if (url.pathname === "/api/team/simulate-pix" && request.method === "POST") {
      if (production) throw httpError(404, "Rota disponivel apenas em desenvolvimento.");
      assertSameOrigin(request);
      system.requireTeam(readCookie(request, "av_session"), "payments:simulate");
      return json(response, 200, system.confirmPixPayment(await body(request)));
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

function setSessionCookie(response, sessionId) {
  response.setHeader(
    "Set-Cookie",
    cookie("av_session", signCookie(sessionId), { maxAge: 12 * 60 * 60 }),
  );
}

function cookie(name, value, { maxAge }) {
  const secure = production ? "; Secure" : "";
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

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

function loginAttemptKey(request, scope, identifier) {
  const ip = String(request.headers["x-forwarded-for"] || request.socket.remoteAddress || "local")
    .split(",")[0]
    .trim();
  return `${scope}:${ip}:${String(identifier || "")
    .trim()
    .toLowerCase()}`;
}

function assertLoginAllowed(key) {
  const attempt = loginAttempts.get(key);
  if (!attempt) return;
  if (attempt.lockedUntil && attempt.lockedUntil > Date.now()) {
    throw httpError(429, "Muitas tentativas de login. Aguarde antes de tentar novamente.");
  }
  if (attempt.lockedUntil && attempt.lockedUntil <= Date.now()) loginAttempts.delete(key);
}

function recordLoginFailure(key) {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const lockMs = 15 * 60 * 1000;
  const current = loginAttempts.get(key);
  const attempt =
    current && current.firstAt + windowMs > now
      ? current
      : { count: 0, firstAt: now, lockedUntil: 0 };
  attempt.count += 1;
  if (attempt.count >= 5) attempt.lockedUntil = now + lockMs;
  loginAttempts.set(key, attempt);
}

function clearLoginAttempts(key) {
  loginAttempts.delete(key);
}

function normalizePixWebhook(payload) {
  const providerPayment = payload.payment || payload.data || {};
  const providerStatus = String(payload.status || providerPayment.status || "").toUpperCase();
  const paidStatuses = new Set(["PAID", "RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]);
  return {
    paymentId: payload.paymentId || providerPayment.id,
    eventId: payload.eventId || payload.id || `${providerPayment.id}:${providerStatus}`,
    status: paidStatuses.has(providerStatus) ? "paid" : payload.status,
  };
}

function sanitizeFileName(fileName) {
  return (
    basename(String(fileName || "documento"))
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120) || "documento"
  );
}

function signCookie(value) {
  const signature = createHmac("sha256", sessionSecret).update(value).digest("base64url");
  return `${value}.${signature}`;
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

function readinessReport() {
  const backupRestore = readBackupDrillEvidence();
  const webhookDrill = readWebhookDrillEvidence();
  const providerApproval = readProviderApprovalEvidence();
  const deploymentCheck = readDeploymentEvidence();
  const backupSchedule = readBackupScheduleEvidence();
  const domainTls = readDomainTlsEvidence();
  const schemaCheck = readSchemaCheckEvidence();
  const sessionSecurity = readSessionSecurityEvidence();
  const releaseGate = evaluateReleaseGate(readinessDir);
  return {
    production,
    paymentProvider: paymentProvider?.name || "dev-pix",
    backupRestore,
    webhookDrill,
    providerApproval,
    deploymentCheck,
    backupSchedule,
    domainTls,
    schemaCheck,
    sessionSecurity,
    releaseGate,
    gates: [
      readinessGate(
        "Pix provider",
        paymentProvider?.name === "asaas",
        production
          ? "PAYMENT_PROVIDER=asaas ativo."
          : "Ambiente local usa provider de desenvolvimento.",
      ),
      readinessGate("Banco de dados", Boolean(dbFile), `DB configurado em ${dbFile}`),
      readinessGate(
        "Storage privado",
        !normalize(documentStorageDir).startsWith(normalize(publicDir)),
        "Receitas ficam fora de public/.",
      ),
      readinessGate(
        "Sessao assinada",
        Boolean(sessionSecret),
        production ? "SESSION_SECRET configurado." : "Usando segredo local de desenvolvimento.",
      ),
      readinessGate(
        "Webhook Pix",
        Boolean(webhookSecret) && webhookDrill?.ok === true,
        webhookDrill?.ok
          ? `Assinatura rejeitada sem segredo e confirmada com segredo em ${formatBrazilDateTime(webhookDrill.checkedAt)}.`
          : "Pendente: executar npm run readiness:webhook-drill para provar assinatura e confirmacao Pix.",
      ),
      readinessGate(
        "Aceite do provider",
        providerApproval?.ok === true,
        providerApproval?.ok
          ? `${providerApproval.provider} aprovado em ${formatBrazilDateTime(providerApproval.checkedAt)}; evidencia ${providerApproval.evidenceRef}.`
          : "Pendente: registrar aceite formal do provider com npm run readiness:provider-evidence.",
      ),
      readinessGate(
        "Deploy/domain/logs",
        deploymentCheck?.ok === true &&
          (!production ||
            (deploymentCheck.https === true && deploymentCheck.logsEvidence === true)),
        deploymentCheck?.ok
          ? `Health e rotas protegidas verificados em ${formatBrazilDateTime(deploymentCheck.checkedAt)} para ${deploymentCheck.baseUrl}.`
          : "Pendente: executar npm run readiness:deployment-check contra o ambiente de release.",
      ),
      readinessGate(
        "Dominio/TLS",
        domainTls?.ok === true,
        domainTls?.ok
          ? `TLS valido para ${domainTls.hostname} ate ${formatBrazilDateTime(domainTls.validTo)}.`
          : "Pendente: executar READINESS_DOMAIN_URL=https://dominio npm run readiness:domain-tls para provar dominio profissional e certificado valido.",
      ),
      readinessGate(
        "Schema DB",
        schemaCheck?.ok === true,
        schemaCheck?.ok
          ? `Schema ${schemaCheck.schemaVersion} validado com ${schemaCheck.tableCount} tabelas em ${formatBrazilDateTime(schemaCheck.checkedAt)}.`
          : "Pendente: executar DB_FILE=<sqlite> npm run readiness:schema-check para provar schema e migrations.",
      ),
      readinessGate(
        "Sessao/cookie",
        sessionSecurity?.ok === true,
        sessionSecurity?.ok
          ? `Cookie de sessao assinado, HttpOnly e SameSite validado em ${formatBrazilDateTime(sessionSecurity.checkedAt)}.`
          : "Pendente: executar READINESS_BASE_URL=<url> npm run readiness:session-security para provar cookie de sessao.",
      ),
      readinessGate(
        "Backup/restore",
        backupRestore?.ok === true,
        backupRestore?.ok
          ? `Restore drill validado em ${formatBrazilDateTime(backupRestore.checkedAt)} com ${backupRestore.backupFileName}.`
          : "Pendente: executar npm run readiness:backup-drill e anexar evidencia ao release.",
      ),
      readinessGate(
        "Backup offsite",
        backupSchedule?.ok === true,
        backupSchedule?.ok
          ? `${backupSchedule.frequency} com retencao ${backupSchedule.retention}; ultimo offsite em ${formatBrazilDateTime(backupSchedule.lastSuccessfulBackupAt)}.`
          : "Pendente: executar npm run readiness:backup-schedule com destino offsite, retencao e ultimo backup validado.",
      ),
    ],
  };
}

function readinessGate(label, ok, detail) {
  return { label, status: ok ? "ok" : "pending", detail };
}

function readBackupDrillEvidence() {
  if (!existsSync(backupDrillEvidenceFile)) return null;
  try {
    const evidence = JSON.parse(readFileSync(backupDrillEvidenceFile, "utf8"));
    return {
      ok: evidence.ok === true,
      checkedAt: evidence.checkedAt,
      backupFileName: evidence.backupFileName || basename(evidence.backupFile || ""),
      bytes: evidence.bytes,
      sha256: evidence.sha256,
      counts: evidence.counts || {},
      restore: evidence.restore || {},
    };
  } catch {
    return {
      ok: false,
      checkedAt: null,
      backupFileName: "",
      bytes: 0,
      sha256: "",
      counts: {},
      restore: { loaded: false },
    };
  }
}

function readWebhookDrillEvidence() {
  if (!existsSync(webhookDrillEvidenceFile)) return null;
  try {
    const evidence = JSON.parse(readFileSync(webhookDrillEvidenceFile, "utf8"));
    return {
      ok: evidence.ok === true,
      checkedAt: evidence.checkedAt,
      baseUrl: evidence.baseUrl,
      paymentId: evidence.paymentId,
      orderId: evidence.orderId,
      unsignedStatus: evidence.unsignedStatus,
      signedStatus: evidence.signedStatus,
      finalOrderStatus: evidence.finalOrderStatus,
      stockAfterPayment: evidence.stockAfterPayment,
      durationMs: evidence.durationMs,
    };
  } catch {
    return {
      ok: false,
      checkedAt: null,
      baseUrl: "",
      paymentId: "",
      orderId: "",
      unsignedStatus: 0,
      signedStatus: 0,
      finalOrderStatus: "",
      stockAfterPayment: null,
      durationMs: 0,
    };
  }
}

function readProviderApprovalEvidence() {
  if (!existsSync(providerApprovalEvidenceFile)) return null;
  try {
    const evidence = JSON.parse(readFileSync(providerApprovalEvidenceFile, "utf8"));
    return {
      ok:
        evidence.status === "approved" &&
        Boolean(evidence.provider) &&
        Boolean(evidence.accountStatus) &&
        Boolean(evidence.evidenceRef) &&
        Boolean(evidence.termsRef) &&
        Boolean(evidence.webhookDocsRef) &&
        Boolean(evidence.settlementNotes),
      checkedAt: evidence.checkedAt,
      provider: evidence.provider || "",
      status: evidence.status || "pending",
      accountStatus: evidence.accountStatus || "",
      evidenceRef: evidence.evidenceRef || "",
      termsRef: evidence.termsRef || "",
      webhookDocsRef: evidence.webhookDocsRef || "",
      settlementNotes: evidence.settlementNotes || "",
    };
  } catch {
    return {
      ok: false,
      checkedAt: null,
      provider: "",
      status: "invalid",
      accountStatus: "",
      evidenceRef: "",
      termsRef: "",
      webhookDocsRef: "",
      settlementNotes: "",
    };
  }
}

async function writeProviderApprovalEvidence(sessionId, input) {
  const actor = system.requireTeam(sessionId, "team:write");
  const evidence = {
    checkedAt: new Date().toISOString(),
    provider: cleanEvidenceText(input.provider),
    status: normalizeEvidenceStatus(input.status, ["pending", "approved", "rejected"], "pending"),
    accountStatus: cleanEvidenceText(input.accountStatus),
    evidenceRef: cleanEvidenceText(input.evidenceRef),
    termsRef: cleanEvidenceText(input.termsRef),
    webhookDocsRef: cleanEvidenceText(input.webhookDocsRef),
    settlementNotes: cleanEvidenceText(input.settlementNotes),
  };
  const requiredForApproval = [
    "provider",
    "accountStatus",
    "evidenceRef",
    "termsRef",
    "webhookDocsRef",
    "settlementNotes",
  ];
  const missing =
    evidence.status === "approved" ? requiredForApproval.filter((key) => !evidence[key]) : [];
  if (missing.length) throw httpError(400, `Aceite do provider precisa de: ${missing.join(", ")}.`);
  await mkdir(dirname(providerApprovalEvidenceFile), { recursive: true });
  await writeFile(providerApprovalEvidenceFile, `${JSON.stringify(evidence, null, 2)}\n`, {
    mode: 0o600,
  });
  system.audit("provider_approval_evidence_recorded", actor.id, {
    provider: evidence.provider,
    status: evidence.status,
    accountStatus: evidence.accountStatus,
  });
  system.persist();
  return readProviderApprovalEvidence();
}

function readDeploymentEvidence() {
  if (!existsSync(deploymentEvidenceFile)) return null;
  try {
    const evidence = JSON.parse(readFileSync(deploymentEvidenceFile, "utf8"));
    const routes = evidence.routes || {};
    return {
      ok: evidence.ok === true,
      checkedAt: evidence.checkedAt,
      baseUrl: evidence.baseUrl || "",
      production: evidence.production === true,
      https: evidence.https === true,
      healthStatus: evidence.healthStatus,
      catalogDeniedStatus: evidence.catalogDeniedStatus,
      protectedRouteStatus: evidence.protectedRouteStatus,
      protectedRouteLocation: evidence.protectedRouteLocation || "",
      securityHeaders: evidence.securityHeaders || {},
      logsEvidence: evidence.logsEvidence === true,
      logsRef: evidence.logsRef || "",
      routes,
    };
  } catch {
    return {
      ok: false,
      checkedAt: null,
      baseUrl: "",
      production: false,
      https: false,
      healthStatus: 0,
      catalogDeniedStatus: 0,
      protectedRouteStatus: 0,
      protectedRouteLocation: "",
      securityHeaders: {},
      logsEvidence: false,
      logsRef: "",
      routes: {},
    };
  }
}

function readBackupScheduleEvidence() {
  if (!existsSync(backupScheduleEvidenceFile)) return null;
  try {
    const evidence = JSON.parse(readFileSync(backupScheduleEvidenceFile, "utf8"));
    return {
      ok:
        evidence.status === "configured" &&
        Boolean(evidence.offsiteTargetRef) &&
        Boolean(evidence.frequency) &&
        Boolean(evidence.retention) &&
        Boolean(evidence.encryptionRef) &&
        Boolean(evidence.lastSuccessfulBackupAt) &&
        Boolean(evidence.lastBackupRef) &&
        Boolean(evidence.restoreDrillSha256) &&
        Boolean(evidence.operatorRef),
      checkedAt: evidence.checkedAt,
      status: evidence.status || "pending",
      offsiteTargetRef: evidence.offsiteTargetRef || "",
      frequency: evidence.frequency || "",
      retention: evidence.retention || "",
      encryptionRef: evidence.encryptionRef || "",
      lastSuccessfulBackupAt: evidence.lastSuccessfulBackupAt || "",
      lastBackupRef: evidence.lastBackupRef || "",
      restoreDrillSha256: evidence.restoreDrillSha256 || "",
      operatorRef: evidence.operatorRef || "",
    };
  } catch {
    return {
      ok: false,
      checkedAt: null,
      status: "invalid",
      offsiteTargetRef: "",
      frequency: "",
      retention: "",
      encryptionRef: "",
      lastSuccessfulBackupAt: "",
      lastBackupRef: "",
      restoreDrillSha256: "",
      operatorRef: "",
    };
  }
}

function readDomainTlsEvidence() {
  if (!existsSync(domainTlsEvidenceFile)) return null;
  try {
    const evidence = JSON.parse(readFileSync(domainTlsEvidenceFile, "utf8"));
    const tls = evidence.tls || {};
    const health = evidence.health || {};
    return {
      ok:
        evidence.ok === true &&
        evidence.https === true &&
        evidence.professionalHost === true &&
        tls.authorized === true &&
        health.status === 200,
      checkedAt: evidence.checkedAt,
      url: evidence.url || "",
      hostname: evidence.hostname || "",
      https: evidence.https === true,
      professionalHost: evidence.professionalHost === true,
      authorized: tls.authorized === true,
      authorizationError: tls.authorizationError || "",
      issuer: tls.issuer || {},
      subject: tls.subject || {},
      validFrom: tls.validFrom || "",
      validTo: tls.validTo || "",
      fingerprint256: tls.fingerprint256 || "",
      healthStatus: health.status || 0,
    };
  } catch {
    return {
      ok: false,
      checkedAt: null,
      url: "",
      hostname: "",
      https: false,
      professionalHost: false,
      authorized: false,
      authorizationError: "invalid evidence",
      issuer: {},
      subject: {},
      validFrom: "",
      validTo: "",
      fingerprint256: "",
      healthStatus: 0,
    };
  }
}

function readSchemaCheckEvidence() {
  if (!existsSync(schemaCheckEvidenceFile)) return null;
  try {
    const evidence = JSON.parse(readFileSync(schemaCheckEvidenceFile, "utf8"));
    return {
      ok: evidence.ok === true,
      checkedAt: evidence.checkedAt,
      dbFile: evidence.dbFile || "",
      expectedVersion: evidence.expectedVersion,
      schemaVersion: evidence.schemaVersion,
      tableCount: Array.isArray(evidence.requiredTables) ? evidence.requiredTables.length : 0,
      missingTables: evidence.missingTables || [],
      migrations: evidence.migrations || [],
    };
  } catch {
    return {
      ok: false,
      checkedAt: null,
      dbFile: "",
      expectedVersion: 0,
      schemaVersion: 0,
      tableCount: 0,
      missingTables: [],
      migrations: [],
    };
  }
}

function readSessionSecurityEvidence() {
  if (!existsSync(sessionSecurityEvidenceFile)) return null;
  try {
    const evidence = JSON.parse(readFileSync(sessionSecurityEvidenceFile, "utf8"));
    const cookie = evidence.cookie || {};
    const secureRequired = evidence.secureRequired === true;
    return {
      ok:
        evidence.ok === true &&
        cookie.name === "av_session" &&
        cookie.httpOnly === true &&
        cookie.sameSite === "Lax" &&
        cookie.path === "/" &&
        Number(cookie.maxAge) > 0 &&
        Number(cookie.maxAge) <= 12 * 60 * 60 &&
        cookie.signedValue === true &&
        (!secureRequired || cookie.secure === true),
      checkedAt: evidence.checkedAt,
      baseUrl: evidence.baseUrl || "",
      production: evidence.production === true,
      secureRequired,
      loginStatus: evidence.loginStatus || 0,
      durationMs: evidence.durationMs || 0,
      cookie: {
        name: cookie.name || "",
        path: cookie.path || "",
        maxAge: Number(cookie.maxAge || 0),
        sameSite: cookie.sameSite || "",
        httpOnly: cookie.httpOnly === true,
        secure: cookie.secure === true,
        signedValue: cookie.signedValue === true,
      },
    };
  } catch {
    return {
      ok: false,
      checkedAt: null,
      baseUrl: "",
      production: false,
      secureRequired: false,
      loginStatus: 0,
      durationMs: 0,
      cookie: {
        name: "",
        path: "",
        maxAge: 0,
        sameSite: "",
        httpOnly: false,
        secure: false,
        signedValue: false,
      },
    };
  }
}

async function writeBackupScheduleEvidence(sessionId, input) {
  const actor = system.requireTeam(sessionId, "team:write");
  const backupRestore = readBackupDrillEvidence();
  const evidence = {
    checkedAt: new Date().toISOString(),
    status: normalizeEvidenceStatus(input.status, ["pending", "configured", "disabled"], "pending"),
    offsiteTargetRef: cleanEvidenceText(input.offsiteTargetRef),
    frequency: cleanEvidenceText(input.frequency),
    retention: cleanEvidenceText(input.retention),
    encryptionRef: cleanEvidenceText(input.encryptionRef),
    lastSuccessfulBackupAt: cleanEvidenceText(input.lastSuccessfulBackupAt),
    lastBackupRef: cleanEvidenceText(input.lastBackupRef),
    restoreDrillSha256: cleanEvidenceText(input.restoreDrillSha256) || backupRestore?.sha256 || "",
    restoreDrillCheckedAt: backupRestore?.checkedAt || "",
    operatorRef: cleanEvidenceText(input.operatorRef),
  };
  const requiredForConfigured = [
    "offsiteTargetRef",
    "frequency",
    "retention",
    "encryptionRef",
    "lastSuccessfulBackupAt",
    "lastBackupRef",
    "restoreDrillSha256",
    "operatorRef",
  ];
  const missing =
    evidence.status === "configured" ? requiredForConfigured.filter((key) => !evidence[key]) : [];
  if (missing.length)
    throw httpError(400, `Backup offsite configurado precisa de: ${missing.join(", ")}.`);
  await mkdir(dirname(backupScheduleEvidenceFile), { recursive: true });
  await writeFile(backupScheduleEvidenceFile, `${JSON.stringify(evidence, null, 2)}\n`, {
    mode: 0o600,
  });
  system.audit("backup_schedule_evidence_recorded", actor.id, {
    status: evidence.status,
    offsiteTargetRef: evidence.offsiteTargetRef,
    frequency: evidence.frequency,
  });
  system.persist();
  return readBackupScheduleEvidence();
}

function cleanEvidenceText(value) {
  return String(value || "")
    .trim()
    .slice(0, 500);
}

function normalizeEvidenceStatus(value, allowed, fallback) {
  const normalized = String(value || fallback)
    .trim()
    .toLowerCase();
  return allowed.includes(normalized) ? normalized : fallback;
}

function formatBrazilDateTime(value) {
  if (!value) return "data nao registrada";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}
