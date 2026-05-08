// Phase 3 — GET /api/team/activity?since=<isoTimestamp>
//
// Next.js Route Handler. Returns audit events filtered by `since` so the
// command center can poll for new activity without re-rendering the entire
// dashboard.
//
// Bridge note (CLAUDE.md frozen-server policy): this is the FIRST Next.js
// Route Handler in the app. server.mjs's pathname switch-statement does not
// reach Next for /api/* paths unless the path is included in `appRoutes`
// (the Next allow-list). We add `/api/team/activity` to that allow-list as
// a one-line routing-policy delegation, NOT as new business logic in
// server.mjs. The behavior lives entirely in this Route Handler.
//
// We reuse the existing /api/team/dashboard endpoint (which already returns
// auditLog) by forwarding the session cookie. This keeps zero new endpoints
// and zero new methods on production-system.

export const dynamic = "force-dynamic";

const TEAM_RELEVANT_ACTIONS = new Set([
  "patient_login",
  "team_login",
  "team_user_bootstrapped",
  "team_user_created",
  "team_user_status_updated",
  "team_user_password_reset",
  "team_user_password_changed",
  "patient_concurrent_checkout_blocked",
  "paid_after_expiry_conflict",
  "checkout_created",
  "payment_confirmed",
  "payment_reconciled",
  "payment_reconciliation_exception",
  "support_request_created",
  "support_request_updated",
  "patient_access_recovery_requested",
  "patient_access_updated",
  "patient_invite_reset",
  "patient_created",
  "stock_added",
  "cultivation_batch_created",
  "cultivation_batch_advanced",
  "cultivation_harvest_recorded",
  "cultivation_dry_weight_recorded",
  "cultivation_batch_stocked",
  "member_card_issued",
  "privacy_consent_accepted",
  "provider_approval_evidence_recorded",
  "backup_schedule_evidence_recorded",
]);

export async function GET(request) {
  const url = new URL(request.url);
  const sinceParam = url.searchParams.get("since");
  const since = parseSince(sinceParam);

  const cookie = request.headers.get("cookie") || "";
  const dashboardUrl = new URL("/api/team/dashboard", url.origin);

  let upstream;
  try {
    upstream = await fetch(dashboardUrl, {
      method: "GET",
      headers: { cookie },
      cache: "no-store",
    });
  } catch (error) {
    return jsonResponse(502, {
      error: "Falha ao consultar painel da equipe.",
      detail: String(error?.message || error),
    });
  }

  const upstreamPayload = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return jsonResponse(upstream.status, upstreamPayload);
  }

  const auditLog = Array.isArray(upstreamPayload.auditLog) ? upstreamPayload.auditLog : [];
  const events = auditLog
    .filter((event) => TEAM_RELEVANT_ACTIONS.has(event.action))
    .filter((event) => {
      if (!since) return true;
      const at = new Date(event.at).getTime();
      return Number.isFinite(at) && at > since;
    })
    .map((event) => ({
      id: event.id,
      action: event.action,
      actor: event.actor,
      details: event.details || null,
      at: event.at,
    }));

  return jsonResponse(200, {
    since: since ? new Date(since).toISOString() : null,
    now: new Date().toISOString(),
    count: events.length,
    events,
  });
}

function parseSince(value) {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
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
