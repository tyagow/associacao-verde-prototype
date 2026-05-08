// POST /api/team/simulate-pix — dev-only Pix simulator.
// Refuses to run when production=true.

import { getSystem } from "../../../../src/system-instance.ts";
import {
  readJsonBody,
  readSessionCookie,
  jsonResponse,
  errorResponse,
} from "../../../../src/route-helpers.ts";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { system, production } = getSystem();
    if (production) {
      const err = new Error("Rota disponivel apenas em desenvolvimento.");
      err.status = 404;
      throw err;
    }
    const sessionId = readSessionCookie(request.headers.get("cookie"));
    system.requireTeam(sessionId, "payments:simulate");
    const payload = await readJsonBody(request);
    return jsonResponse(200, system.confirmPixPayment(payload));
  } catch (error) {
    return errorResponse(error);
  }
}
