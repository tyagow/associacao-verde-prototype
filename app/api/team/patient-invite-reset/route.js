// POST /api/team/patient-invite-reset — resetPatientInvite returns its own envelope.

import { teamWrite } from "../../../../src/route-helpers.ts";

export const dynamic = "force-dynamic";

export const POST = teamWrite((system, sessionId, payload) =>
  system.resetPatientInvite(sessionId, payload),
);
