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

export interface NormalizedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

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

export type QuestionBankStatus = "published" | "archived";
export type QuestionTagSource = "manual" | "ai_suggestion";

export interface QuestionTag {
  id: string;
  category: string;
  value: string;
  source: QuestionTagSource;
}

export interface QuestionBankSubquestion {
  id: string;
  sourceSubquestionDraftId?: string;
  ordinal: number;
  label: string;
  promptText: string;
  maximumPoints?: number;
}

export interface QuestionBankQuestion {
  id: string;
  sourceQuestionDraftId: string;
  sourceDocumentId: string;
  pageId: string;
  originalName: string;
  pageNumber: number;
  label: string;
  title: string;
  promptText: string;
  status: QuestionBankStatus;
  sourceName: string;
  competitionYear?: number;
  questionNumber?: number;
  primaryTopic: string;
  secondaryTopics: string[];
  difficulty?: number;
  questionType: string;
  methods: string[];
  proofRequired: boolean;
  estimatedMinutes?: number;
  maximumPoints?: number;
  scoringNotes: string;
  priority: number;
  tags: QuestionTag[];
  subquestions: QuestionBankSubquestion[];
  createdAt: string;
  updatedAt: string;
}

export interface QuestionBankMetadataInput {
  sourceName: string;
  competitionYear?: number;
  questionNumber?: number;
  primaryTopic: string;
  secondaryTopics: string[];
  difficulty?: number;
  questionType: string;
  methods: string[];
  proofRequired: boolean;
  estimatedMinutes?: number;
  maximumPoints?: number;
  scoringNotes: string;
  priority: number;
  tags: Array<{ category: string; value: string; source?: QuestionTagSource }>;
  subquestions: Array<
    Omit<QuestionBankSubquestion, "id" | "sourceSubquestionDraftId"> & {
      sourceSubquestionDraftId?: string;
    }
  >;
}

export interface PublishQuestionDraftInput {
  questionDraftId: string;
  metadata: QuestionBankMetadataInput;
}

export interface QuestionBankFilter {
  query?: string;
  sourceName?: string;
  competitionYear?: number;
  primaryTopic?: string;
  difficulty?: number;
  questionType?: string;
  proofRequired?: boolean;
  limit?: number;
}

export type MockExamStatus = "draft" | "active" | "submitted" | "archived";
export interface MockExamItem {
  id: string;
  ordinal: number;
  questionId: string;
  maximumPoints?: number;
  title: string;
  label: string;
  promptText: string;
  primaryTopic: string;
  difficulty?: number;
  sessionId: string;
  responseCount: number;
  submittedResponseCount: number;
}
export interface MockExamSummary {
  id: string;
  title: string;
  status: MockExamStatus;
  durationSeconds: number;
  questionCount: number;
  startedAt?: string;
  submittedAt?: string;
  createdAt: string;
  updatedAt: string;
}
export interface MockExamDetail extends MockExamSummary {
  items: MockExamItem[];
}
export interface CreateMockExamInput {
  title: string;
  questionIds: string[];
  durationSeconds?: number;
}

export interface KnowledgeNode {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}
export interface KnowledgeEdge {
  id: string;
  prerequisiteNodeId: string;
  dependentNodeId: string;
  strength: number;
}
export interface IrtItemParameter {
  questionId: string;
  difficulty: number;
  discrimination: number;
  guessing: number;
  source: "manual" | "heuristic";
  updatedAt: string;
}
export interface QuestionKnowledgeMapping {
  questionId: string;
  nodeId: string;
  weight: number;
}
export interface AbilitySnapshot {
  nodeId: string;
  theta: number;
  standardError: number;
  evidenceCount: number;
  updatedAt: string;
}
export interface AdaptiveRecommendation {
  question: QuestionBankQuestion;
  reason: "upstream" | "weakness" | "stretch" | "review";
  predictedProbability: number;
  targetNodeId: string;
  targetNodeName: string;
}
export interface AdaptiveTrainingProfile {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  mappings: QuestionKnowledgeMapping[];
  parameters: IrtItemParameter[];
  abilities: AbilitySnapshot[];
  recommendations: AdaptiveRecommendation[];
  notice: string;
}
export interface SaveKnowledgeNodeInput {
  id?: string;
  name: string;
  description: string;
}
export interface SaveKnowledgeEdgeInput {
  id?: string;
  prerequisiteNodeId: string;
  dependentNodeId: string;
  strength: number;
}
export interface SaveIrtItemParameterInput {
  questionId: string;
  difficulty: number;
  discrimination: number;
  guessing: number;
  source: "manual" | "heuristic";
  nodeIds: string[];
}

export interface TutorMethod {
  name: string;
  outline: string;
  keyIdea: string;
  pitfalls: string;
}
export interface TutorPlan {
  prerequisiteKnowledge: string[];
  entryPoint: string;
  thoughtSource: string;
  methods: TutorMethod[];
  similarType: string;
  variants: string[];
  socraticQuestion: string;
}
export interface TutorSession {
  id: string;
  questionId: string;
  providerId: string;
  status: "active" | "archived";
  questionText: string;
  answerText: string;
  plan?: TutorPlan;
  createdAt: string;
  updatedAt: string;
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    createdAt: string;
  }>;
}
export interface TutorPrepareInput {
  questionId: string;
  responseId?: string;
}
export interface TutorPreview {
  authorizationToken: string;
  expiresAt: string;
  providerLabel: string;
  model: string;
  questionId: string;
  questionText: string;
  answerText: string;
  disclosure: string[];
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

export interface InkPoint {
  x: number;
  y: number;
  pressure: number;
  t: number;
}

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

export interface InkStroke extends InkStrokeInput {
  id: string;
}
export interface InkLayer extends Omit<InkLayerInput, "strokes" | "id"> {
  id: string;
  strokes: InkStroke[];
}
export interface InkResponseDetail {
  responseId: string;
  sessionId: string;
  canvasWidth: number;
  canvasHeight: number;
  previewSvg: string;
  createdAt: string;
  layers: InkLayer[];
}
export interface InkSaveResult {
  session: PracticeSessionDetail;
  ink: InkResponseDetail;
}

export interface BackupSummary {
  backupId: string;
  createdAt: string;
  documentCount: number;
  responseCount: number;
  attachmentCount: number;
  fileCount: number;
}

export interface BackupSelection extends BackupSummary {
  token: string;
  fileName: string;
}

export interface BackupExportResult extends BackupSummary {
  outputName: string;
  cancelled?: boolean;
}

export type AssessmentOrigin = "manual" | "ai";
export type AssessmentStatus = "draft" | "confirmed";
export type MistakeCategory =
  | "conceptual"
  | "method"
  | "reasoning"
  | "completeness"
  | "calculation"
  | "communication"
  | "time"
  | "other";
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

export interface AssessmentEvidence extends AssessmentEvidenceInput {
  id: string;
}
export interface AssessmentMistake extends AssessmentMistakeInput {
  id: string;
}
export interface AssessmentModule extends AssessmentModuleInput {
  id: string;
}

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
  history: Array<{
    assessmentId: string;
    createdAt: string;
    scoreRate: number;
  }>;
  modules: Array<{
    module: string;
    awardedPoints: number;
    maximumPoints: number;
    scoreRate: number;
  }>;
  mistakes: Array<{ category: MistakeCategory; count: number }>;
  aiStatus: "not_configured";
}

export interface AiProviderConfigInput {
  id?: string;
  providerLabel: string;
  baseUrl: string;
  model: string;
  apiKey?: string;
  enabled: boolean;
}

export interface AiProviderSummary {
  id: string;
  providerLabel: string;
  baseUrl: string;
  model: string;
  enabled: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AiProviderRegistry {
  secureStorageAvailable: boolean;
  providers: AiProviderSummary[];
  defaultProviderId?: string;
  requiresPerRequestApproval: true;
  message: string;
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

export interface AiConnectionResult {
  providerId: string;
  ok: boolean;
  latencyMs: number;
  models: string[];
  message: string;
}

export interface AiAssessmentPrepareInput {
  sessionId: string;
  responseId: string;
  questionText: string;
  scoreMaximum: number;
}

export interface AiAssessmentPreview {
  authorizationToken: string;
  expiresAt: string;
  providerId: string;
  providerLabel: string;
  model: string;
  sessionTitle: string;
  referenceKey: string;
  answerFormat: AnswerFormat;
  questionText: string;
  answerText: string;
  scoreMaximum: number;
  attachments: ResponseAttachmentSummary[];
  disclosure: string[];
}

export interface AiAssessmentRunResult {
  auditId: string;
  assessment: AssessmentRecordDetail;
  providerLabel: string;
  model: string;
  responseExcerpt: string;
}

export interface AutoReviewDocumentResult {
  sourceDocumentId: string;
  originalName: string;
  pagesReviewed: number;
  questionsPublished: number;
  warnings: string[];
}

export interface AutoReviewSummary {
  providerLabel: string;
  model: string;
  documents: AutoReviewDocumentResult[];
  failures: string[];
}

export interface VariantGenerateInput {
  questionId: string;
  count?: number;
}

export interface MockExamComposeInput {
  title?: string;
}
