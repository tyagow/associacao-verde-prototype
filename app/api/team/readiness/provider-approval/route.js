// POST /api/team/readiness/provider-approval — record provider approval evidence.

import {
  readJsonBody,
  readSessionCookie,
  jsonResponse,
  errorResponse,
} from "../../../../../src/route-helpers.ts";
import { writeProviderApprovalEvidence } from "../../../../../src/readiness.ts";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const sessionId = readSessionCookie(request.headers.get("cookie"));
    const payload = await readJsonBody(request);
    const providerApproval = await writeProviderApprovalEvidence(sessionId, payload);
    return jsonResponse(200, { providerApproval });
  } catch (error) {
    return errorResponse(error);
  }
}
