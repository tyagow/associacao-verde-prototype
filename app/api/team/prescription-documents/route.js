// POST /api/team/prescription-documents — register a prescription document.
//
// Accepts a JSON body with base64-encoded file content (the UI in
// app/equipe/pacientes/PatientsClient.jsx and smoke/e2e drivers all
// send this shape). The handler stores the file under the private
// document storage dir (mode 0o600, sha256-named, never inside public/),
// then registers the record with the shared system singleton.

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

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
    const { system, documentStorageDir } = getSystem();
    const sessionId = readSessionCookie(request.headers.get("cookie"));
    const payload = await readJsonBody(request);
    const stored = await storePrescriptionPayload(payload, documentStorageDir);
    const result = system.registerPrescriptionDocument(sessionId, stored);
    return jsonResponse(201, result);
  } catch (error) {
    return errorResponse(error);
  }
}

async function storePrescriptionPayload(payload, documentStorageDir) {
  if (!payload.fileContentBase64) return payload;
  await mkdir(documentStorageDir, { recursive: true });
  const fileName = sanitizeFileName(payload.fileName || "receita.pdf");
  const content = Buffer.from(String(payload.fileContentBase64), "base64");
  if (!content.length) {
    const err = new Error("Arquivo da receita vazio.");
    err.status = 400;
    throw err;
  }
  if (content.length > 5_000_000) {
    const err = new Error("Arquivo da receita excede 5 MB.");
    err.status = 413;
    throw err;
  }
  const sha = createHash("sha256").update(content).digest("hex");
  const storedName = `${Date.now()}-${sha.slice(0, 16)}-${fileName}`;
  const filePath = join(documentStorageDir, storedName);
  await writeFile(filePath, content, { flag: "wx", mode: 0o600 });
  return {
    ...payload,
    fileContentBase64: undefined,
    storageKey: `private-documents://${storedName}`,
    privateFilePath: filePath,
    sha256: sha,
  };
}

export function sanitizeFileName(fileName) {
  return (
    basename(String(fileName || "documento"))
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120) || "documento"
  );
}
