import { createHash, randomUUID } from "node:crypto";
import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { App } from "electron";
import { getDatabase } from "./database.js";
import { createDocumentPages } from "./database.js";
import { extractPages } from "./ocr.js";
import type { ImportJobSummary, ImportKind } from "./types.js";

const acceptedExtensions = new Set([
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".heic",
  ".txt",
  ".md",
]);

const mimeByExtension: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".heic": "image/heic",
  ".txt": "text/plain",
  ".md": "text/markdown",
};

export function getArchiveDirectory(app: App) {
  return path.join(app.getPath("userData"), "archive", "originals");
}

export async function ensureArchiveDirectory(app: App) {
  const target = getArchiveDirectory(app);
  await mkdir(target, { recursive: true });
  return target;
}

export async function archiveFiles(
  app: App,
  filePaths: string[],
  kind: ImportKind
): Promise<ImportJobSummary[]> {
  const destination = await ensureArchiveDirectory(app);
  const db = getDatabase(app);
  const createdAt = new Date().toISOString();
  const jobs: ImportJobSummary[] = [];

  for (const filePath of filePaths) {
    const originalName = path.basename(filePath);
    const extension = path.extname(originalName).toLowerCase();
    if (!acceptedExtensions.has(extension))
      throw new Error(`${originalName} 不是可导入的资料格式。`);
    const contents = await readFile(filePath);
    if (contents.byteLength === 0)
      throw new Error(`${originalName} 是空文件。`);
    if (contents.byteLength > 100 * 1024 * 1024)
      throw new Error(`${originalName} 超过 100 MB 的单文件导入限制。`);

    const sourceDocumentId = randomUUID();
    const jobId = randomUUID();
    const storedName = `${sourceDocumentId}${extension}`;
    const sha256 = createHash("sha256").update(contents).digest("hex");
    const storedPath = path.join(destination, storedName);
    await copyFile(filePath, storedPath);
    const status = "needs_review" as const;
    const transaction = db.transaction(() => {
      db.prepare(
        `INSERT INTO source_documents (id, original_name, source_kind, stored_name, sha256, mime_type, size_bytes, imported_at)
        VALUES (@id, @originalName, @kind, @storedName, @sha256, @mimeType, @sizeBytes, @importedAt)`
      ).run({
        id: sourceDocumentId,
        originalName,
        kind,
        storedName,
        sha256,
        mimeType: mimeByExtension[extension] ?? "application/octet-stream",
        sizeBytes: contents.byteLength,
        importedAt: createdAt,
      });
      db.prepare(
        `INSERT INTO import_jobs (id, source_document_id, status, created_at, updated_at)
        VALUES (@id, @sourceDocumentId, @status, @createdAt, @updatedAt)`
      ).run({
        id: jobId,
        sourceDocumentId,
        status,
        createdAt,
        updatedAt: createdAt,
      });
    });
    transaction();
    const pages = await extractPages(storedPath);
    createDocumentPages(app, sourceDocumentId, pages);
    jobs.push({
      id: jobId,
      sourceDocumentId,
      originalName,
      kind,
      status,
      createdAt,
    });
  }
  return jobs;
}

export const importFileFilters = [
  {
    name: "欧几里得资料",
    extensions: ["pdf", "png", "jpg", "jpeg", "heic", "txt", "md"],
  },
];
