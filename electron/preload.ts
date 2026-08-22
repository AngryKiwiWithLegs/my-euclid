import { contextBridge, ipcRenderer } from "electron";
import type { ArchiveHealth, BackupExportResult, BackupSelection, ImportJobSummary, ImportKind, ImportResult, InkResponseDetail, InkSaveResult, NormalizedRect, OcrRegion, PracticeSessionDetail, QuestionDraft, ReviewDocumentDetail, ReviewDocumentSummary, ReviewPagePreview, SaveInkResponseInput, SavePracticeResponseInput } from "./types.js";

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
    getPagePreview: (pageId: string): Promise<ReviewPagePreview> => ipcRenderer.invoke("review:get-page-preview", pageId),
    recognizeRegion: (input: { pageId: string; rect: NormalizedRect }): Promise<OcrRegion> => ipcRenderer.invoke("review:recognize-region", input),
    updatePageOcr: (pageId: string, ocrText: string): Promise<void> => ipcRenderer.invoke("review:update-page-ocr", pageId, ocrText),
    saveQuestionDrafts: (sourceDocumentId: string, questions: QuestionDraft[]): Promise<void> => ipcRenderer.invoke("review:save-question-drafts", sourceDocumentId, questions),
  },
  practice: {
    saveResponse: (input: SavePracticeResponseInput): Promise<PracticeSessionDetail> => ipcRenderer.invoke("practice:save-response", input),
    selectPaperAttachments: (input: { sessionId?: string; referenceKey: string; title: string }): Promise<{ session?: PracticeSessionDetail; cancelled?: boolean }> => ipcRenderer.invoke("practice:select-paper-attachments", input),
    saveInkResponse: (input: SaveInkResponseInput): Promise<InkSaveResult> => ipcRenderer.invoke("practice:save-ink-response", input),
    getInkResponse: (responseId: string): Promise<InkResponseDetail | null> => ipcRenderer.invoke("practice:get-ink-response", responseId),
  },
  backup: {
    export: (): Promise<BackupExportResult> => ipcRenderer.invoke("backup:export"),
    selectForRestore: (): Promise<{ selection?: BackupSelection; cancelled?: boolean }> => ipcRenderer.invoke("backup:select-for-restore"),
    restore: (token: string): Promise<BackupSelection> => ipcRenderer.invoke("backup:restore", token),
  },
  app: { openExternal: (url: string): Promise<void> => ipcRenderer.invoke("app:open-external", url) },
});
