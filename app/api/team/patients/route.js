// POST /api/team/patients — team creates a patient.

import { teamWrite } from "../../../../src/route-helpers.ts";

export const dynamic = "force-dynamic";

export const POST = teamWrite(
  (system, sessionId, payload) => system.createPatient(sessionId, payload),
  { status: 201, wrap: (patient) => ({ patient }) },
);
