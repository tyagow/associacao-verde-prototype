// POST /api/team/readiness/backup-schedule — record backup schedule evidence.

import {
  readJsonBody,
  readSessionCookie,
  jsonResponse,
  errorResponse,
} from "../../../../../src/route-helpers.ts";
import { writeBackupScheduleEvidence } from "../../../../../src/readiness.ts";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const sessionId = readSessionCookie(request.headers.get("cookie"));
    const payload = await readJsonBody(request);
    const backupSchedule = await writeBackupScheduleEvidence(sessionId, payload);
    return jsonResponse(200, { backupSchedule });
  } catch (error) {
    return errorResponse(error);
  }
}
