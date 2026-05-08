// POST /api/webhooks/pix — Pix provider webhook.
//
// Verifies the X-Webhook-Secret header with timingSafeEqual (preserves
// the constant-time comparison that 05fa251 introduced) and confirms
// the payment via the shared singleton.

import { timingSafeEqual } from "node:crypto";
import { getSystem } from "../../../../src/system-instance.ts";
import {
  readJsonBody,
  jsonResponse,
  errorResponse,
  ipFromRequest,
  assertRateLimit,
  recordRateLimitHit,
} from "../../../../src/route-helpers.ts";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const ip = ipFromRequest(request);
    const rateKey = `webhook-pix:${ip}`;
    assertRateLimit(rateKey, 200, 60_000);
    recordRateLimitHit(rateKey);
    const { system, webhookSecret } = getSystem();
    const provided = String(request.headers.get("x-webhook-secret") || "");
    const expected = String(webhookSecret || "");
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      const err = new Error("Webhook Pix sem assinatura valida.");
      err.status = 401;
      throw err;
    }
    const payload = await readJsonBody(request);
    return jsonResponse(200, system.confirmPixPayment(normalizePixWebhook(payload)));
  } catch (error) {
    return errorResponse(error);
  }
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
