import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to reset data with NODE_ENV=production.");
  process.exit(1);
}

const dbFile = resolve(process.env.DB_FILE || join(root, "data", "associacao-verde.sqlite"));
const documentStorageDir = resolve(
  process.env.DOCUMENT_STORAGE_DIR || join(root, "data", "private-documents"),
);

for (const target of [dbFile, documentStorageDir]) {
  if (!existsSync(target)) {
    console.log(`skip missing ${target}`);
    continue;
  }
  await rm(target, { force: true, recursive: true });
  console.log(`removed ${target}`);
}
