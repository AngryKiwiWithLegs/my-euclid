import { createHash, randomUUID } from "node:crypto";
import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { App } from "electron";
import { addResponseAttachment, createPaperResponse, getPracticeSession, savePracticeResponse } from "./database.js";
import type { PracticeSessionDetail, SavePracticeResponseInput } from "./types.js";

const answerExtensions = new Set([".pdf", ".png", ".jpg", ".jpeg", ".heic"]);
const mimeByExtension: Record<string, string> = { ".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".heic": "image/heic" };

function responseDirectory(app: App) { return path.join(app.getPath("userData"), "archive", "responses"); }

export async function saveResponse(app: App, input: SavePracticeResponseInput): Promise<PracticeSessionDetail> { return savePracticeResponse(app, input); }

export async function importResponseAttachments(app: App, input: { sessionId?: string; referenceKey: string; title: string; filePaths: string[] }): Promise<PracticeSessionDetail> {
  await mkdir(responseDirectory(app), { recursive: true });
  const paper = createPaperResponse(app, input.sessionId ?? "", input.referenceKey, input.title);
  for (const filePath of input.filePaths) {
    const originalName = path.basename(filePath);
    const extension = path.extname(originalName).toLowerCase();
    if (!answerExtensions.has(extension)) throw new Error(`${originalName} 不是可用的答卷附件格式。`);
    const contents = await readFile(filePath);
    if (contents.byteLength === 0 || contents.byteLength > 100 * 1024 * 1024) throw new Error(`${originalName} 的文件大小不符合要求。`);
    const id = randomUUID();
    const storedName = `${id}${extension}`;
    await copyFile(filePath, path.join(responseDirectory(app), storedName));
    addResponseAttachment(app, { id, responseId: paper.responseId, originalName, storedName, sha256: createHash("sha256").update(contents).digest("hex"), mimeType: mimeByExtension[extension], sizeBytes: contents.byteLength });
  }
  return getPracticeSession(app, paper.sessionId)!;
}

export const responseFileFilters = [{ name: "答卷附件", extensions: ["pdf", "png", "jpg", "jpeg", "heic"] }];
