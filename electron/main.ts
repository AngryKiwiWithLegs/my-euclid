import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { archiveFiles, ensureArchiveDirectory, importFileFilters } from "./archive.js";
import { databaseHealth, getDatabase, listImportJobs } from "./database.js";
import { getReviewDocument, listReviewDocuments, saveQuestionDrafts, updatePageOcr } from "./database.js";
import type { ImportKind, ImportResult, QuestionDraft } from "./types.js";

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
  ipcMain.handle("app:open-external", async (_event, url: string) => {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") throw new Error("只允许打开 HTTPS 链接。");
    await shell.openExternal(parsed.toString());
  });
  createWindow();
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
