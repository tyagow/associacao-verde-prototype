// GET /api/team/prescription-documents/[id]/download — serve a prescription document.
//
// Validates the requester is allowed via system.getPrescriptionDocumentForDownload,
// then streams the encrypted-on-disk file (private-documents/) back with the
// original mime type, an attachment Content-Disposition, and a checksum check
// against the stored sha256.

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { normalize } from "node:path";

import { getSystem } from "../../../../../../src/system-instance.ts";
import {
  readSessionCookie,
  jsonResponse,
  errorResponse,
} from "../../../../../../src/route-helpers.ts";
import { sanitizeFileName } from "../../route.js";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  try {
    const { system, documentStorageDir } = getSystem();
    const sessionId = readSessionCookie(request.headers.get("cookie"));
    const { id } = await params;
    const documentRecord = system.getPrescriptionDocumentForDownload(sessionId, id);

    const filePath = normalize(documentRecord.privateFilePath || "");
    const safeRoot = normalize(documentStorageDir);
    if (!filePath.startsWith(safeRoot) || !existsSync(filePath)) {
      return jsonResponse(404, { error: "Documento nao encontrado no storage privado." });
    }
    const content = await readFile(filePath);
    const hash = createHash("sha256").update(content).digest("hex");
    if (hash !== documentRecord.sha256) {
      return jsonResponse(409, { error: "Checksum do documento nao confere." });
    }
    return new Response(content, {
      status: 200,
      headers: {
        "Content-Type": documentRecord.mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${sanitizeFileName(documentRecord.fileName)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
