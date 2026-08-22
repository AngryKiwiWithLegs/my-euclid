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

export type OcrStatus = "pending" | "extracted" | "failed" | "reviewed";
export type ReviewStatus = "needs_review" | "confirmed";

export interface ReviewDocumentSummary {
  sourceDocumentId: string;
  originalName: string;
  kind: ImportKind;
  importedAt: string;
  pageCount: number;
  reviewStatus: ReviewStatus;
}

export interface ReviewPage {
  id: string;
  pageNumber: number;
  ocrText: string;
  ocrStatus: OcrStatus;
  reviewStatus: ReviewStatus;
}

export interface SubquestionDraft {
  id?: string;
  label: string;
  text: string;
  ordinal: number;
}

export interface QuestionDraft {
  id?: string;
  pageId: string;
  label: string;
  title: string;
  promptText: string;
  ordinal: number;
  subquestions: SubquestionDraft[];
}

export interface ReviewDocumentDetail extends ReviewDocumentSummary {
  pages: ReviewPage[];
  questions: QuestionDraft[];
}

export type AnswerFormat = "keyboard" | "handwritten" | "paper_attachment";
export type PracticeSessionStatus = "active" | "submitted" | "archived";

export interface ResponseAttachmentSummary {
  id: string;
  responseId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface PracticeResponse {
  id: string;
  sessionId: string;
  answerFormat: AnswerFormat;
  content: string;
  status: "draft" | "submitted";
  version: number;
  createdAt: string;
  attachments: ResponseAttachmentSummary[];
}

export interface PracticeSessionDetail {
  id: string;
  referenceKey: string;
  title: string;
  status: PracticeSessionStatus;
  startedAt: string;
  updatedAt: string;
  responses: PracticeResponse[];
}

export interface SavePracticeResponseInput {
  sessionId?: string;
  referenceKey: string;
  title: string;
  answerFormat: Exclude<AnswerFormat, "paper_attachment">;
  content: string;
  status: "draft" | "submitted";
}

export interface BackupSummary {
  backupId: string;
  createdAt: string;
  documentCount: number;
  responseCount: number;
  attachmentCount: number;
  fileCount: number;
}

export interface BackupSelection extends BackupSummary { token: string; fileName: string; }

export interface BackupExportResult extends BackupSummary { outputName: string; cancelled?: boolean; }
