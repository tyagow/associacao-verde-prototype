// POST /api/team/payments/reconcile — reconcile a Pix payment.

import { getSystem } from "../../../../../src/system-instance.ts";
import {
  readJsonBody,
  readSessionCookie,
  jsonResponse,
  errorResponse,
} from "../../../../../src/route-helpers.ts";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { system } = getSystem();
    const sessionId = readSessionCookie(request.headers.get("cookie"));
    const payload = await readJsonBody(request);
    const result = await system.reconcilePayment(sessionId, payload);
    return jsonResponse(200, result);
  } catch (error) {
    return errorResponse(error);
  }
}
