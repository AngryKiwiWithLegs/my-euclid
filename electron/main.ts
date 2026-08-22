import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { archiveFiles, ensureArchiveDirectory, importFileFilters } from "./archive.js";
import { exportBackup, preflightBackup, restoreBackup } from "./backup.js";
import { databaseHealth, getDatabase, getInkResponse, listImportJobs, saveInkResponse } from "./database.js";
import { getReviewDocument, listReviewDocuments, saveQuestionDrafts, updatePageOcr } from "./database.js";
import { importResponseAttachments, responseFileFilters, saveResponse } from "./practice.js";
import type { ImportKind, ImportResult, QuestionDraft, SaveInkResponseInput, SavePracticeResponseInput } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDevelopment = Boolean(process.env.VITE_DEV_SERVER_URL);

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 980,
    minWidth: 1120,
    minHeight: 720,
    backgroundColor: "#F5F0E5",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  if (isDevelopment) window.loadURL(process.env.VITE_DEV_SERVER_URL!);
  else window.loadFile(path.join(app.getAppPath(), "dist", "public", "index.html"));
  return window;
}

app.whenReady().then(async () => {
  getDatabase(app);
  await ensureArchiveDirectory(app);
  ipcMain.handle("archive:get-health", () => databaseHealth(app, true));
  ipcMain.handle("archive:list-import-jobs", () => listImportJobs(app));
  ipcMain.handle("review:list-documents", () => listReviewDocuments(app));
  ipcMain.handle("review:get-document", (_event, sourceDocumentId: string) => getReviewDocument(app, sourceDocumentId));
  ipcMain.handle("review:update-page-ocr", (_event, pageId: string, ocrText: string) => updatePageOcr(app, pageId, ocrText));
  ipcMain.handle("review:save-question-drafts", (_event, sourceDocumentId: string, questions: QuestionDraft[]) => saveQuestionDrafts(app, sourceDocumentId, questions));
  ipcMain.handle("practice:save-response", (_event, input: SavePracticeResponseInput) => {
    if (!input || !["keyboard", "handwritten"].includes(input.answerFormat) || !["draft", "submitted"].includes(input.status)) throw new Error("作答格式或保存状态无效。");
    if (input.content.length > 500_000) throw new Error("单次作答文本超过保存限制。");
    return saveResponse(app, input);
  });
  ipcMain.handle("practice:save-ink-response", (_event, input: SaveInkResponseInput) => {
    if (!input || !["draft", "submitted"].includes(input.status) || !Number.isFinite(input.canvasWidth) || !Number.isFinite(input.canvasHeight)) throw new Error("笔迹保存参数无效。");
    if (input.layers.length > 16 || input.layers.reduce((count, layer) => count + layer.strokes.length, 0) > 4_000) throw new Error("笔迹图层或笔画数量超过本地保存限制。");
    if (input.layers.some(layer => layer.strokes.some(stroke => stroke.points.length > 10_000 || stroke.points.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(point.t))))) throw new Error("笔迹点序列包含无效数据。");
    return saveInkResponse(app, input);
  });
  ipcMain.handle("practice:get-ink-response", (_event, responseId: string) => getInkResponse(app, responseId));
  ipcMain.handle("practice:select-paper-attachments", async (_event, input: { sessionId?: string; referenceKey: string; title: string }) => {
    const result = await dialog.showOpenDialog({ title: "选择纸质答案附件", buttonLabel: "归档到当前作答", filters: responseFileFilters, properties: ["openFile", "multiSelections"] });
    if (result.canceled) return { cancelled: true };
    return { session: await importResponseAttachments(app, { ...input, filePaths: result.filePaths }) };
  });
  ipcMain.handle("archive:select-and-import", async (_event, kind: ImportKind): Promise<ImportResult> => {
    if (kind !== "source_document" && kind !== "paper_response") throw new Error("不支持的导入类型。");
    const result = await dialog.showOpenDialog({
      title: kind === "paper_response" ? "选择纸质答卷扫描件或照片" : "选择题目资料",
      buttonLabel: "归档并创建审核任务",
      filters: importFileFilters,
      properties: ["openFile", "multiSelections"],
    });
    if (result.canceled) return { jobs: [], cancelled: true };
    return { jobs: await archiveFiles(app, result.filePaths, kind) };
  });
  ipcMain.handle("backup:export", async () => {
    const result = await dialog.showSaveDialog({ title: "导出 My Euclid 本地备份", defaultPath: `My-Euclid-${new Date().toISOString().slice(0, 10)}.myeuclid-backup.zip`, filters: [{ name: "My Euclid 备份包", extensions: ["zip"] }] });
    if (result.canceled || !result.filePath) return { cancelled: true };
    return exportBackup(app, result.filePath);
  });
  ipcMain.handle("backup:select-for-restore", async () => {
    const result = await dialog.showOpenDialog({ title: "选择 My Euclid 备份包", filters: [{ name: "My Euclid 备份包", extensions: ["zip"] }], properties: ["openFile"] });
    if (result.canceled || !result.filePaths[0]) return { cancelled: true };
    return { selection: await preflightBackup(app, result.filePaths[0]) };
  });
  ipcMain.handle("backup:restore", async (_event, token: string) => restoreBackup(app, token));
  ipcMain.handle("app:open-external", async (_event, url: string) => {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") throw new Error("只允许打开 HTTPS 链接。");
    await shell.openExternal(parsed.toString());
  });
  createWindow();
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
