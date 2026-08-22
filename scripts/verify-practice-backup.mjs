import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { exportBackup, preflightBackup, restoreBackup } from "../dist/electron/backup.js";
import { closeDatabase, getDataCounts, getPracticeSession } from "../dist/electron/database.js";
import { importResponseAttachments, saveResponse } from "../dist/electron/practice.js";

const root = await mkdtemp(path.join(os.tmpdir(), "my-euclid-practice-backup-"));
const app = { getPath: (name) => name === "userData" ? path.join(root, "user-data") : path.join(root, "temp") };

try {
  await mkdir(app.getPath("userData"), { recursive: true });
  const first = await saveResponse(app, { referenceKey: "E-2025-07b", title: "Euclid 2025 · 第 7 题 (b)", answerFormat: "keyboard", content: "First proof draft", status: "draft" });
  await writeFile(path.join(root, "paper-answer.png"), "paper answer placeholder", "utf8");
  const withAttachment = await importResponseAttachments(app, { sessionId: first.id, referenceKey: "E-2025-07b", title: "Euclid 2025 · 第 7 题 (b)", filePaths: [path.join(root, "paper-answer.png")] });
  if (withAttachment.responses.flatMap(response => response.attachments).length !== 1) throw new Error("Paper answer attachment was not persisted.");

  const backupPath = path.join(root, "snapshot.myeuclid-backup.zip");
  const exported = await exportBackup(app, backupPath);
  if (!exported.attachmentCount || !exported.responseCount) throw new Error("Backup summary did not include practice data.");
  await saveResponse(app, { sessionId: first.id, referenceKey: "E-2025-07b", title: "Euclid 2025 · 第 7 题 (b)", answerFormat: "keyboard", content: "Later change", status: "submitted" });
  if (getDataCounts(app).responseCount < 3) throw new Error("Post-backup mutation did not persist.");

  const selection = await preflightBackup(app, backupPath);
  await restoreBackup(app, selection.token);
  const restored = getPracticeSession(app, first.id);
  if (!restored || restored.responses.length !== 2 || restored.responses.flatMap(response => response.attachments).length !== 1) throw new Error("Backup restore did not recover the saved response and attachment state.");
  console.log("Practice and backup smoke test passed");
} finally {
  closeDatabase();
  await rm(root, { recursive: true, force: true });
}

process.exit(0);
