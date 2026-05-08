// Phase 7 — GET /api/team/support-thread?ticketId=<id>
//
// Next.js Route Handler. Returns the full chronological conversation for a
// support ticket: the ticket envelope (publicSupportTicket shape) plus a
// `messages` array seeded with the original ticket message followed by all
// rows from the support_messages table (schema v15) in created_at order.
//
// Bridge note: the canonical path is allow-listed in server.mjs `appRoutes`;
// the Route Handler proxies to server.mjs's raw endpoint
// (/api/team/support-thread/_raw, NOT allow-listed) which serves the
// in-process system response.

export const dynamic = "force-dynamic";

export async function GET(request) {
  const url = new URL(request.url);
  const ticketId = url.searchParams.get("ticketId") || "";
  if (!ticketId) {
    return jsonResponse(400, { error: "ticketId e obrigatorio." });
  }

  const cookie = request.headers.get("cookie") || "";
  const rawUrl = new URL("/api/team/support-thread/_raw", url.origin);
  rawUrl.searchParams.set("ticketId", ticketId);

  let upstream;
  try {
    upstream = await fetch(rawUrl, {
      method: "GET",
      headers: { cookie },
      cache: "no-store",
    });
  } catch (error) {
    return jsonResponse(502, {
      error: "Falha ao consultar conversa de suporte.",
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
