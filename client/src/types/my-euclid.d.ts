export {};

declare global {
  type MyEuclidImportKind = "source_document" | "paper_response";
  type MyEuclidImportStatus = "queued" | "archived" | "needs_review" | "failed";
  interface MyEuclidImportJob { id: string; sourceDocumentId: string; originalName: string; kind: MyEuclidImportKind; status: MyEuclidImportStatus; createdAt: string; errorMessage?: string; }
  interface MyEuclidArchiveHealth { mode: "desktop"; databaseReady: boolean; archiveReady: boolean; documentCount: number; pendingReviewCount: number; }
  interface Window {
    myEuclid?: {
      archive: {
        getHealth: () => Promise<MyEuclidArchiveHealth>;
        listImportJobs: () => Promise<MyEuclidImportJob[]>;
        selectAndImport: (kind: MyEuclidImportKind) => Promise<{ jobs: MyEuclidImportJob[]; cancelled?: boolean }>;
      };
      app: { openExternal: (url: string) => Promise<void> };
    };
  }
}
