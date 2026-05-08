// Phase 7 — POST /api/team/support-replies
//
// Next.js Route Handler. Accepts { ticketId, body } JSON, forwards the
// session cookie to server.mjs's raw system endpoint
// (/api/team/support-replies/_raw), and returns the persisted reply
// (id, ticketId, authorType, authorId, authorName, body, createdAt).
//
// Bridge note (CLAUDE.md frozen-server policy): the canonical path
// `/api/team/support-replies` is allow-listed in server.mjs's `appRoutes`,
// so requests reach this handler. The actual system mutation lives in
// server.mjs's switch under the `_raw` suffix; it is NOT allow-listed,
// so server.mjs handles it directly with the in-process system instance.
// This keeps server.mjs additions to one allow-list line + the raw
// endpoint, with audited business logic centralized in
// ProductionSystem.createSupportReply.

export const dynamic = "force-dynamic";

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(400, { error: "Corpo da requisicao invalido." });
  }
  const ticketId = String(payload?.ticketId || "").trim();
  const body = String(payload?.body || "").trim();
  if (!ticketId || !body) {
    return jsonResponse(400, { error: "Atendimento e mensagem sao obrigatorios." });
  }

  const cookie = request.headers.get("cookie") || "";
  const url = new URL(request.url);
  const rawUrl = new URL("/api/team/support-replies/_raw", url.origin);

  let upstream;
  try {
    upstream = await fetch(rawUrl, {
      method: "POST",
      headers: {
        cookie,
        "Content-Type": "application/json",
        // Same-origin assertion in server.mjs reads the Origin header.
        origin: url.origin,
      },
      body: JSON.stringify({ ticketId, body }),
      cache: "no-store",
    });
  } catch (error) {
    return jsonResponse(502, {
      error: "Falha ao registrar resposta de suporte.",
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
