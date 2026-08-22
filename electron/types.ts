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
  regions: OcrRegion[];
}

export interface NormalizedRect { x: number; y: number; width: number; height: number; }

export interface OcrRegion {
  id: string;
  pageId: string;
  rect: NormalizedRect;
  ocrText: string;
  ocrStatus: OcrStatus;
  createdAt: string;
}

export interface ReviewPagePreview {
  pageId: string;
  pageNumber: number;
  available: boolean;
  sourceKind: "pdf" | "image" | "text";
  dataUrl?: string;
  width?: number;
  height?: number;
  reason?: string;
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

export interface InkPoint { x: number; y: number; pressure: number; t: number; }

export interface InkStrokeInput {
  id?: string;
  ordinal: number;
  tool: "pen" | "eraser";
  color: string;
  width: number;
  points: InkPoint[];
}

export interface InkLayerInput {
  id?: string;
  title: string;
  ordinal: number;
  visible: boolean;
  strokes: InkStrokeInput[];
}

export interface SaveInkResponseInput {
  sessionId?: string;
  referenceKey: string;
  title: string;
  status: "draft" | "submitted";
  canvasWidth: number;
  canvasHeight: number;
  previewSvg: string;
  layers: InkLayerInput[];
}

export interface InkStroke extends InkStrokeInput { id: string; }
export interface InkLayer extends Omit<InkLayerInput, "strokes" | "id"> { id: string; strokes: InkStroke[]; }
export interface InkResponseDetail { responseId: string; sessionId: string; canvasWidth: number; canvasHeight: number; previewSvg: string; createdAt: string; layers: InkLayer[]; }
export interface InkSaveResult { session: PracticeSessionDetail; ink: InkResponseDetail; }

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

export type AssessmentOrigin = "manual" | "ai";
export type AssessmentStatus = "draft" | "confirmed";
export type MistakeCategory = "conceptual" | "method" | "reasoning" | "completeness" | "calculation" | "communication" | "time" | "other";
export type MistakeSeverity = "minor" | "moderate" | "major";

export interface AssessmentEvidenceInput {
  id?: string;
  criterion: string;
  maximumPoints: number;
  awardedPoints: number;
  rationale: string;
  responseQuote: string;
  ordinal: number;
}

export interface AssessmentMistakeInput {
  id?: string;
  category: MistakeCategory;
  module: string;
  severity: MistakeSeverity;
  note: string;
  ordinal: number;
}

export interface AssessmentModuleInput {
  id?: string;
  module: string;
  awardedPoints: number;
  maximumPoints: number;
  note: string;
  ordinal: number;
}

export interface SaveAssessmentInput {
  sessionId: string;
  responseId: string;
  status: AssessmentStatus;
  scoreAwarded: number;
  scoreMaximum: number;
  overallFeedback: string;
  summary: string;
  evidence: AssessmentEvidenceInput[];
  mistakes: AssessmentMistakeInput[];
  modules: AssessmentModuleInput[];
}

export interface AssessmentEvidence extends AssessmentEvidenceInput { id: string; }
export interface AssessmentMistake extends AssessmentMistakeInput { id: string; }
export interface AssessmentModule extends AssessmentModuleInput { id: string; }

export interface AssessmentRecordSummary {
  id: string;
  sessionId: string;
  responseId: string;
  referenceKey: string;
  title: string;
  responseVersion: number;
  answerFormat: AnswerFormat;
  origin: AssessmentOrigin;
  status: AssessmentStatus;
  version: number;
  scoreAwarded: number;
  scoreMaximum: number;
  overallFeedback: string;
  summary: string;
  createdAt: string;
  confirmedAt?: string;
}

export interface AssessmentRecordDetail extends AssessmentRecordSummary {
  evidence: AssessmentEvidence[];
  mistakes: AssessmentMistake[];
  modules: AssessmentModule[];
}

export interface AssessmentDashboard {
  assessmentCount: number;
  confirmedCount: number;
  weightedScoreRate: number | null;
  latestScoreRate: number | null;
  recentAssessments: AssessmentRecordSummary[];
  history: Array<{ assessmentId: string; createdAt: string; scoreRate: number }>;
  modules: Array<{ module: string; awardedPoints: number; maximumPoints: number; scoreRate: number }>;
  mistakes: Array<{ category: MistakeCategory; count: number }>;
  aiStatus: "not_configured";
}

export interface AiProviderConfigInput {
  providerLabel: string;
  baseUrl: string;
  model: string;
  apiKey: string;
}

export interface AiProviderStatus {
  configured: boolean;
  secureStorageAvailable: boolean;
  providerLabel?: string;
  baseUrl?: string;
  model?: string;
  updatedAt?: string;
  requiresPerRequestApproval: true;
  message: string;
}
