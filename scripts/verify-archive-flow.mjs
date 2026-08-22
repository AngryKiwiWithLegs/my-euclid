import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { archiveFiles, getArchiveDirectory } from "../dist/electron/archive.js";
import { listImportJobs } from "../dist/electron/database.js";

const directory = mkdtempSync(path.join(tmpdir(), "my-euclid-archive-flow-"));
const sourcePath = path.join(directory, "euclid-note.txt");
const app = { getPath: () => directory };

try {
  writeFileSync(sourcePath, "Euclid import smoke test", "utf8");
  const jobs = await archiveFiles(app, [sourcePath], "source_document");
  if (jobs.length !== 1 || jobs[0].status !== "needs_review") throw new Error("Import job was not created.");
  const storedPath = path.join(getArchiveDirectory(app), `${jobs[0].sourceDocumentId}.txt`);
  if (!existsSync(storedPath)) throw new Error("Original file was not copied into the archive.");
  const listed = listImportJobs(app);
  if (listed.length !== 1 || listed[0].originalName !== "euclid-note.txt") throw new Error("Import job was not persisted.");
  console.log("Archive flow smoke test passed");
} finally {
  rmSync(directory, { recursive: true, force: true });
}
process.exit(0);
