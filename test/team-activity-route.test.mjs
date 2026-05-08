import assert from "node:assert/strict";
import test from "node:test";

import { GET } from "../app/api/team/activity/route.js";

function buildRequest({ url = "http://localhost:3000/api/team/activity", cookie = "" } = {}) {
  return new Request(url, {
    method: "GET",
    headers: { cookie },
  });
}

function withMockFetch(payload, status = 200) {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  return () => {
    globalThis.fetch = original;
  };
}

test("team activity route returns filtered audit events newer than `since`", async () => {
  const restore = withMockFetch({
    auditLog: [
      { id: "1", action: "team_login", actor: "u1", details: {}, at: "2026-05-07T12:00:00.000Z" },
      {
        id: "2",
        action: "payment_confirmed",
        actor: "system",
        details: { orderId: "o1" },
        at: "2026-05-07T13:00:00.000Z",
      },
      {
        id: "3",
        action: "team_login",
        actor: "u2",
        details: {},
        at: "2026-05-07T14:00:00.000Z",
      },
      {
        id: "4",
        action: "internal_only_event_not_in_allow_list",
        actor: "system",
        details: {},
        at: "2026-05-07T15:00:00.000Z",
      },
    ],
  });
  try {
    const url = new URL("http://localhost:3000/api/team/activity");
    url.searchParams.set("since", "2026-05-07T12:30:00.000Z");
    const response = await GET(buildRequest({ url: url.toString(), cookie: "av_session=abc" }));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.count, 2);
    const ids = body.events.map((event) => event.id);
    assert.deepEqual(ids, ["2", "3"]);
    // Allow-list filtering: action #4 must not appear regardless of timestamp.
    assert.ok(
      !body.events.some((event) => event.action === "internal_only_event_not_in_allow_list"),
    );
  } finally {
    restore();
  }
});

test("team activity route returns full filtered list when no `since` is provided", async () => {
  const restore = withMockFetch({
    auditLog: [
      {
        id: "a",
        action: "checkout_created",
        actor: "p1",
        details: {},
        at: "2026-05-07T10:00:00.000Z",
      },
      {
        id: "b",
        action: "payment_confirmed",
        actor: "system",
        details: {},
        at: "2026-05-07T11:00:00.000Z",
      },
    ],
  });
  try {
    const response = await GET(buildRequest());
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.count, 2);
    assert.equal(body.since, null);
    assert.ok(body.now);
  } finally {
    restore();
  }
});

test("team activity route propagates upstream auth errors", async () => {
  const restore = withMockFetch({ error: "Sessao da equipe ausente." }, 401);
  try {
    const response = await GET(buildRequest());
    assert.equal(response.status, 401);
    const body = await response.json();
    assert.equal(body.error, "Sessao da equipe ausente.");
  } finally {
    restore();
  }
});
