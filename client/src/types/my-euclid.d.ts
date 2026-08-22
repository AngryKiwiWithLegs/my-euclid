export {};

declare global {
  type MyEuclidImportKind = "source_document" | "paper_response";
  type MyEuclidImportStatus = "queued" | "archived" | "needs_review" | "failed";
  interface MyEuclidImportJob { id: string; sourceDocumentId: string; originalName: string; kind: MyEuclidImportKind; status: MyEuclidImportStatus; createdAt: string; errorMessage?: string; }
  interface MyEuclidArchiveHealth { mode: "desktop"; databaseReady: boolean; archiveReady: boolean; documentCount: number; pendingReviewCount: number; }
  type MyEuclidOcrStatus = "pending" | "extracted" | "failed" | "reviewed";
  type MyEuclidReviewStatus = "needs_review" | "confirmed";
  interface MyEuclidReviewPage { id: string; pageNumber: number; ocrText: string; ocrStatus: MyEuclidOcrStatus; reviewStatus: MyEuclidReviewStatus; }
  interface MyEuclidSubquestionDraft { id?: string; label: string; text: string; ordinal: number; }
  interface MyEuclidQuestionDraft { id?: string; pageId: string; label: string; title: string; promptText: string; ordinal: number; subquestions: MyEuclidSubquestionDraft[]; }
  interface MyEuclidReviewDocumentSummary { sourceDocumentId: string; originalName: string; kind: MyEuclidImportKind; importedAt: string; pageCount: number; reviewStatus: MyEuclidReviewStatus; }
  interface MyEuclidReviewDocumentDetail extends MyEuclidReviewDocumentSummary { pages: MyEuclidReviewPage[]; questions: MyEuclidQuestionDraft[]; }
  type MyEuclidAnswerFormat = "keyboard" | "handwritten" | "paper_attachment";
  interface MyEuclidResponseAttachment { id: string; responseId: string; originalName: string; mimeType: string; sizeBytes: number; createdAt: string; }
  interface MyEuclidPracticeResponse { id: string; sessionId: string; answerFormat: MyEuclidAnswerFormat; content: string; status: "draft" | "submitted"; version: number; createdAt: string; attachments: MyEuclidResponseAttachment[]; }
  interface MyEuclidPracticeSession { id: string; referenceKey: string; title: string; status: "active" | "submitted" | "archived"; startedAt: string; updatedAt: string; responses: MyEuclidPracticeResponse[]; }
  interface MyEuclidBackupSummary { backupId: string; createdAt: string; documentCount: number; responseCount: number; attachmentCount: number; fileCount: number; }
  interface MyEuclidBackupSelection extends MyEuclidBackupSummary { token: string; fileName: string; }
  interface MyEuclidBackupExport extends MyEuclidBackupSummary { outputName: string; cancelled?: boolean; }
  interface Window {
    myEuclid?: {
      archive: {
        getHealth: () => Promise<MyEuclidArchiveHealth>;
        listImportJobs: () => Promise<MyEuclidImportJob[]>;
        selectAndImport: (kind: MyEuclidImportKind) => Promise<{ jobs: MyEuclidImportJob[]; cancelled?: boolean }>;
      };
      review: {
        listDocuments: () => Promise<MyEuclidReviewDocumentSummary[]>;
        getDocument: (sourceDocumentId: string) => Promise<MyEuclidReviewDocumentDetail | null>;
        updatePageOcr: (pageId: string, ocrText: string) => Promise<void>;
        saveQuestionDrafts: (sourceDocumentId: string, questions: MyEuclidQuestionDraft[]) => Promise<void>;
      };
      practice: {
        saveResponse: (input: { sessionId?: string; referenceKey: string; title: string; answerFormat: "keyboard" | "handwritten"; content: string; status: "draft" | "submitted" }) => Promise<MyEuclidPracticeSession>;
        selectPaperAttachments: (input: { sessionId?: string; referenceKey: string; title: string }) => Promise<{ session?: MyEuclidPracticeSession; cancelled?: boolean }>;
      };
      backup: {
        export: () => Promise<MyEuclidBackupExport | { cancelled: true }>;
        selectForRestore: () => Promise<{ selection?: MyEuclidBackupSelection; cancelled?: boolean }>;
        restore: (token: string) => Promise<MyEuclidBackupSummary>;
      };
      app: { openExternal: (url: string) => Promise<void> };
    };
  }
}
