export type ImportKind = "source_document" | "paper_response";

export type ImportJobStatus = "queued" | "archived" | "needs_review" | "failed";

export interface ImportJobSummary {
  id: string;
  sourceDocumentId: string;
  originalName: string;
  kind: ImportKind;
  status: ImportJobStatus;
  createdAt: string;
  errorMessage?: string;
}

export interface ArchiveHealth {
  mode: "desktop";
  databaseReady: boolean;
  archiveReady: boolean;
  documentCount: number;
  pendingReviewCount: number;
}

export interface ImportResult {
  jobs: ImportJobSummary[];
  cancelled?: boolean;
}
