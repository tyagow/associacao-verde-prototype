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
  const detectedMime = detectAllowedMime(content);
  if (!detectedMime) {
    const err = new Error("Tipo de arquivo nao suportado. Aceite: PDF, JPEG, PNG.");
    err.status = 415;
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
    mimeType: detectedMime,
  };
}

export function detectAllowedMime(buffer) {
  if (!buffer || buffer.length < 4) return null;
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46)
    return "application/pdf";
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  )
    return "image/png";
  return null;
}

export function sanitizeFileName(fileName) {
  return (
    basename(String(fileName || "documento"))
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120) || "documento"
  );
}
