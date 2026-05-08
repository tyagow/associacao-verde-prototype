// Phase 5 — POST /api/team/orders/status
//
// Next.js Route Handler. Driven by the new fulfillment kanban
// (app/equipe/fulfillment) when a team operator drags a card between
// columns. The request body is { orderId: string, status: string }
// where `status` is one of paid_pending_fulfillment | separating |
// ready_to_ship | sent.
//
// Bridge note (CLAUDE.md frozen-server policy): server.mjs's pathname
// switch does not reach Next for /api/* paths unless the path is
// included in `appRoutes` (the Next allow-list). We add
// "/api/team/orders/status" to that allow-list (one-line routing
// delegation) so this Route Handler runs.
//
// The Route Handler validates the input shape and forwards the call
// to the legacy server.mjs surface via a private path that wires the
// shared ProductionSystem singleton + SQLite handle to the new
// `updateOrderFulfillmentStatus` method. We use this two-stage pattern
// (Phase 3 introduced it for /api/team/activity proxying to
// /api/team/dashboard) instead of new code in server.mjs.

export const dynamic = "force-dynamic";

const ALLOWED_STATUSES = new Set([
  "paid_pending_fulfillment",
  "separating",
  "ready_to_ship",
  "sent",
]);

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(400, { error: "Corpo da requisicao invalido." });
  }

  const orderId = String(payload?.orderId || "").trim();
  const status = String(payload?.status || "").trim();
  if (!orderId) return jsonResponse(400, { error: "orderId obrigatorio." });
  if (!ALLOWED_STATUSES.has(status)) {
    return jsonResponse(400, { error: "Status de fulfillment invalido." });
  }

  const url = new URL(request.url);
  const cookie = request.headers.get("cookie") || "";
  const origin = request.headers.get("origin") || url.origin;
  const upstreamUrl = new URL("/api/team/orders/status-apply", url.origin);

  let upstream;
  try {
    upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie,
        origin,
      },
      body: JSON.stringify({ orderId, status }),
      cache: "no-store",
    });
  } catch (error) {
    return jsonResponse(502, {
      error: "Falha ao mover pedido entre colunas.",
      detail: String(error?.message || error),
    });
  }

  const upstreamPayload = await upstream.json().catch(() => ({}));
  return jsonResponse(upstream.status, upstreamPayload);
}

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
