import { contextBridge, ipcRenderer } from "electron";
import type { ArchiveHealth, ImportJobSummary, ImportKind, ImportResult, QuestionDraft, ReviewDocumentDetail, ReviewDocumentSummary } from "./types.js";

const validKind = (kind: ImportKind) => kind === "source_document" || kind === "paper_response";

contextBridge.exposeInMainWorld("myEuclid", {
  archive: {
    getHealth: (): Promise<ArchiveHealth> => ipcRenderer.invoke("archive:get-health"),
    listImportJobs: (): Promise<ImportJobSummary[]> => ipcRenderer.invoke("archive:list-import-jobs"),
    selectAndImport: (kind: ImportKind): Promise<ImportResult> => {
      if (!validKind(kind)) return Promise.reject(new Error("不支持的导入类型。"));
      return ipcRenderer.invoke("archive:select-and-import", kind);
    },
  },
  review: {
    listDocuments: (): Promise<ReviewDocumentSummary[]> => ipcRenderer.invoke("review:list-documents"),
    getDocument: (sourceDocumentId: string): Promise<ReviewDocumentDetail | null> => ipcRenderer.invoke("review:get-document", sourceDocumentId),
    updatePageOcr: (pageId: string, ocrText: string): Promise<void> => ipcRenderer.invoke("review:update-page-ocr", pageId, ocrText),
    saveQuestionDrafts: (sourceDocumentId: string, questions: QuestionDraft[]): Promise<void> => ipcRenderer.invoke("review:save-question-drafts", sourceDocumentId, questions),
  },
  app: { openExternal: (url: string): Promise<void> => ipcRenderer.invoke("app:open-external", url) },
});
