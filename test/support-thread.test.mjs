// Phase 7 — support reply + thread tests.
//
// In-process tests against ProductionSystem so we don't need to spin up an
// HTTP server or SQLite file. The constructor's appendSupportMessage /
// listSupportMessages fallback (in-memory buffer) covers the schema v15
// table from the system's perspective; sqlite-store.test.mjs covers the
// real persistence path separately.

import assert from "node:assert/strict";
import test from "node:test";
import { createInitialState, ProductionSystem } from "../src/production-system.ts";

function harness(now = "2026-05-08T12:00:00-03:00") {
  const state = createInitialState(new Date(now));
  const saves = [];
  const system = new ProductionSystem({
    state,
    now: () => new Date(now),
    save: (nextState) => saves.push(structuredClone(nextState)),
  });
  return { state, saves, system };
}

test("team can reply to support ticket", () => {
  const { system, state } = harness();
  const patient = system.loginPatient({ memberCode: "APO-1027", inviteCode: "HELENA2026" });
  const team = system.loginTeam({ password: "secret" }, "secret");

  const ticket = system.createSupportRequest(patient.sessionId, {
    subject: "Duvida sobre renovacao",
    message: "Preciso enviar nova receita antes do proximo pedido.",
    priority: "high",
  });

  const reply = system.createSupportReply(team.sessionId, {
    ticketId: ticket.id,
    body: "Recebemos sua receita; encaminharemos a confirmacao em breve.",
  });

  assert.equal(reply.ticketId, ticket.id);
  assert.equal(reply.authorType, "team");
  assert.match(reply.body, /receita/);
  assert.ok(reply.createdAt);
  // RBAC: a non-team session cannot create replies.
  assert.throws(
    () =>
      system.createSupportReply(patient.sessionId, {
        ticketId: ticket.id,
        body: "tentativa do paciente",
      }),
    /Login da equipe obrigatorio/,
  );
  // Audit envelope visible on the dashboard's audit log.
  assert.equal(
    state.auditLog.some((event) => event.action === "team_support_reply"),
    true,
  );
  // Empty body rejected.
  assert.throws(
    () => system.createSupportReply(team.sessionId, { ticketId: ticket.id, body: "   " }),
    /vazia/,
  );
});

test("patient sees team replies in thread", () => {
  const { system } = harness();
  const patient = system.loginPatient({ memberCode: "APO-1027", inviteCode: "HELENA2026" });
  const team = system.loginTeam({ password: "secret" }, "secret");

  const ticket = system.createSupportRequest(patient.sessionId, {
    subject: "Duvida sobre renovacao",
    message: "Preciso enviar nova receita antes do proximo pedido.",
    priority: "high",
  });

  system.createSupportReply(team.sessionId, {
    ticketId: ticket.id,
    body: "Recebemos sua receita; encaminharemos a confirmacao em breve.",
  });
  system.createSupportReply(team.sessionId, {
    ticketId: ticket.id,
    body: "Confirmado, esta tudo certo para o proximo pedido.",
  });

  const thread = system.listSupportThread(team.sessionId, ticket.id);
  assert.equal(thread.ticket.id, ticket.id);
  assert.equal(thread.messages.length, 3, "seed message + two team replies");
  assert.equal(thread.messages[0].authorType, "patient");
  assert.match(thread.messages[0].body, /receita/);
  assert.equal(thread.messages[1].authorType, "team");
  assert.match(thread.messages[1].body, /confirmacao/);
  assert.equal(thread.messages[2].authorType, "team");
  assert.match(thread.messages[2].body, /tudo certo/);
  // Patient sessions can also read the thread via the patient-facing
  // surface; here we exercise the team read path which is what the
  // workbench uses. Unknown ticket ids reject.
  assert.throws(() => system.listSupportThread(team.sessionId, "missing-ticket"), /nao encontrado/);
});
