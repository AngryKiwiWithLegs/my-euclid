import AdmZip from "adm-zip";
import { createHash, randomUUID } from "node:crypto";
import {
  copyFile,
  cp,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import type { App } from "electron";
import {
  closeDatabase,
  checkpointDatabase,
  getDataCounts,
  getDatabasePath,
  getDatabase,
  writeBackupAudit,
} from "./database.js";
import type {
  BackupExportResult,
  BackupSelection,
  BackupSummary,
} from "./types.js";

interface BackupManifest extends BackupSummary {
  format: "my-euclid-backup";
  version: 1;
  files: Array<{ path: string; sha256: string; sizeBytes: number }>;
}
const selections = new Map<
  string,
  { filePath: string; summary: BackupSummary }
>();

const hashFile = async (filePath: string) =>
  createHash("sha256")
    .update(await readFile(filePath))
    .digest("hex");
const archiveRoot = (app: App) => path.join(app.getPath("userData"), "archive");

async function enumerateFiles(root: string, prefix = ""): Promise<string[]> {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const relative = path.join(prefix, entry.name);
      if (entry.isDirectory())
        files.push(
          ...(await enumerateFiles(path.join(root, entry.name), relative))
        );
      else files.push(relative);
    }
    return files;
  } catch {
    return [];
  }
}

async function createManifest(
  app: App,
  databaseCopy: string
): Promise<BackupManifest> {
  const backupId = randomUUID();
  const archiveFiles = await enumerateFiles(archiveRoot(app));
  const files = [
    "database/my-euclid.sqlite",
    ...archiveFiles.map(file => path.join("archive", file)),
  ];
  const root = path.dirname(databaseCopy);
  const hashes = await Promise.all(
    files.map(async file => {
      const filePath = file.startsWith("database/")
        ? databaseCopy
        : path.join(app.getPath("userData"), file);
      return {
        path: file.replaceAll(path.sep, "/"),
        sha256: await hashFile(filePath),
        sizeBytes: (await stat(filePath)).size,
      };
    })
  );
  const counts = getDataCounts(app);
  return {
    format: "my-euclid-backup",
    version: 1,
    backupId,
    createdAt: new Date().toISOString(),
    ...counts,
    fileCount: hashes.length,
    files: hashes,
  };
}

async function writeZip(outputPath: string, staging: string) {
  const zip = new AdmZip();
  zip.addLocalFolder(staging);
  zip.writeZip(outputPath);
}

export async function exportBackup(
  app: App,
  outputPath: string
): Promise<BackupExportResult> {
  checkpointDatabase(app);
  const staging = path.join(
    app.getPath("temp"),
    `my-euclid-backup-${randomUUID()}`
  );
  await mkdir(path.join(staging, "database"), { recursive: true });
  const databaseCopy = path.join(staging, "database", "my-euclid.sqlite");
  await copyFile(getDatabasePath(app), databaseCopy);
  const root = archiveRoot(app);
  if (await stat(root).catch(() => null))
    await cp(root, path.join(staging, "archive"), { recursive: true });
  const manifest = await createManifest(app, databaseCopy);
  await writeFile(
    path.join(staging, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8"
  );
  await writeZip(outputPath, staging);
  await rm(staging, { recursive: true, force: true });
  writeBackupAudit(app, "export", manifest.backupId, "success", manifest);
  return { ...manifest, outputName: path.basename(outputPath) };
}

export function validateEntryName(name: string) {
  return !path.isAbsolute(name) && !name.split(/[\\/]+/).includes("..");
}

export async function preflightBackup(
  app: App,
  filePath: string
): Promise<BackupSelection> {
  const zip = new AdmZip(filePath);
  const entry = zip.getEntry("manifest.json");
  if (!entry) throw new Error("备份包缺少 manifest.json。 ");
  const manifest = JSON.parse(
    entry.getData().toString("utf8")
  ) as BackupManifest;
  if (manifest.format !== "my-euclid-backup" || manifest.version !== 1)
    throw new Error("备份包格式或版本不受支持。 ");
  for (const expected of manifest.files) {
    if (!validateEntryName(expected.path))
      throw new Error("备份包包含不安全路径。 ");
    const file = zip.getEntry(expected.path);
    if (
      !file ||
      createHash("sha256").update(file.getData()).digest("hex") !==
        expected.sha256
    )
      throw new Error(`备份校验失败：${expected.path}`);
  }
  const summary: BackupSummary = {
    backupId: manifest.backupId,
    createdAt: manifest.createdAt,
    documentCount: manifest.documentCount,
    responseCount: manifest.responseCount,
    attachmentCount: manifest.attachmentCount,
    fileCount: manifest.fileCount,
  };
  const token = randomUUID();
  selections.set(token, { filePath, summary });
  writeBackupAudit(app, "preflight", manifest.backupId, "success", summary);
  return { ...summary, token, fileName: path.basename(filePath) };
}

export async function restoreBackup(
  app: App,
  token: string
): Promise<BackupSummary> {
  const selection = selections.get(token);
  if (!selection) throw new Error("恢复预检已失效，请重新选择备份包。 ");
  const zip = new AdmZip(selection.filePath);
  const staging = path.join(
    app.getPath("temp"),
    `my-euclid-restore-${randomUUID()}`
  );
  const recovery = path.join(
    app.getPath("userData"),
    "recovery",
    new Date().toISOString().replace(/[:.]/g, "-")
  );
  for (const entry of zip.getEntries())
    if (!validateEntryName(entry.entryName))
      throw new Error("备份包包含不安全路径。 ");
  await mkdir(staging, { recursive: true });
  zip.extractAllTo(staging, true);
  await mkdir(recovery, { recursive: true });
  checkpointDatabase(app);
  await copyFile(getDatabasePath(app), path.join(recovery, "my-euclid.sqlite"));
  if (await stat(archiveRoot(app)).catch(() => null))
    await cp(archiveRoot(app), path.join(recovery, "archive"), {
      recursive: true,
    });
  closeDatabase();
  await copyFile(
    path.join(staging, "database", "my-euclid.sqlite"),
    getDatabasePath(app)
  );
  await rm(archiveRoot(app), { recursive: true, force: true });
  if (await stat(path.join(staging, "archive")).catch(() => null))
    await cp(path.join(staging, "archive"), archiveRoot(app), {
      recursive: true,
    });
  await rm(staging, { recursive: true, force: true });
  selections.delete(token);
  getDatabase(app);
  writeBackupAudit(
    app,
    "restore",
    selection.summary.backupId,
    "success",
    selection.summary
  );
  return selection.summary;
}
