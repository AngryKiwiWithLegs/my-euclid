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
      app: { openExternal: (url: string) => Promise<void> };
    };
  }
}
