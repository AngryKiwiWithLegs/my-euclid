import { contextBridge, ipcRenderer } from "electron";
import type {
  AdaptiveTrainingProfile,
  AiAssessmentPrepareInput,
  AiAssessmentPreview,
  AiAssessmentRunResult,
  AiConnectionResult,
  AiProviderConfigInput,
  AiProviderRegistry,
  AiProviderStatus,
  ArchiveHealth,
  AssessmentDashboard,
  AssessmentRecordDetail,
  AssessmentRecordSummary,
  AutoReviewSummary,
  BackupExportResult,
  BackupSelection,
  CreateMockExamInput,
  ImportJobSummary,
  ImportKind,
  ImportResult,
  InkResponseDetail,
  InkSaveResult,
  MockExamComposeInput,
  MockExamDetail,
  NormalizedRect,
  OcrRegion,
  PracticeSessionDetail,
  PublishQuestionDraftInput,
  QuestionBankFilter,
  QuestionBankQuestion,
  QuestionDraft,
  ReviewDocumentDetail,
  ReviewDocumentSummary,
  ReviewPagePreview,
  SaveAssessmentInput,
  SaveInkResponseInput,
  SaveIrtItemParameterInput,
  SaveKnowledgeEdgeInput,
  SaveKnowledgeNodeInput,
  SavePracticeResponseInput,
  TutorPrepareInput,
  TutorPreview,
  TutorSession,
  VariantGenerateInput,
} from "./types.js";

const validKind = (kind: ImportKind) =>
  kind === "source_document" || kind === "paper_response";
const toDefaultStatus = (registry: AiProviderRegistry): AiProviderStatus => {
  const provider = registry.providers.find(item => item.isDefault);
  return {
    configured: Boolean(provider),
    secureStorageAvailable: registry.secureStorageAvailable,
    providerLabel: provider?.providerLabel,
    baseUrl: provider?.baseUrl,
    model: provider?.model,
    updatedAt: provider?.updatedAt,
    requiresPerRequestApproval: true,
    message: registry.message,
  };
};

contextBridge.exposeInMainWorld("myEuclid", {
  archive: {
    getHealth: (): Promise<ArchiveHealth> =>
      ipcRenderer.invoke("archive:get-health"),
    listImportJobs: (): Promise<ImportJobSummary[]> =>
      ipcRenderer.invoke("archive:list-import-jobs"),
    selectAndImport: (kind: ImportKind): Promise<ImportResult> => {
      if (!validKind(kind))
        return Promise.reject(new Error("不支持的导入类型。"));
      return ipcRenderer.invoke("archive:select-and-import", kind);
    },
  },
  review: {
    listDocuments: (): Promise<ReviewDocumentSummary[]> =>
      ipcRenderer.invoke("review:list-documents"),
    getDocument: (
      sourceDocumentId: string
    ): Promise<ReviewDocumentDetail | null> =>
      ipcRenderer.invoke("review:get-document", sourceDocumentId),
    getPagePreview: (pageId: string): Promise<ReviewPagePreview> =>
      ipcRenderer.invoke("review:get-page-preview", pageId),
    recognizeRegion: (input: {
      pageId: string;
      rect: NormalizedRect;
    }): Promise<OcrRegion> =>
      ipcRenderer.invoke("review:recognize-region", input),
    updatePageOcr: (pageId: string, ocrText: string): Promise<void> =>
      ipcRenderer.invoke("review:update-page-ocr", pageId, ocrText),
    saveQuestionDrafts: (
      sourceDocumentId: string,
      questions: QuestionDraft[]
    ): Promise<void> =>
      ipcRenderer.invoke(
        "review:save-question-drafts",
        sourceDocumentId,
        questions
      ),
    publishQuestionDrafts: (
      sourceDocumentId: string,
      inputs: PublishQuestionDraftInput[]
    ): Promise<QuestionBankQuestion[]> =>
      ipcRenderer.invoke(
        "review:publish-question-drafts",
        sourceDocumentId,
        inputs
      ),
  },
  library: {
    listQuestions: (
      filter: QuestionBankFilter = {}
    ): Promise<QuestionBankQuestion[]> =>
      ipcRenderer.invoke("library:list-questions", filter),
    getQuestion: (questionId: string): Promise<QuestionBankQuestion | null> =>
      ipcRenderer.invoke("library:get-question", questionId),
  },
  mockExam: {
    list: (): Promise<MockExamDetail[]> => ipcRenderer.invoke("mock-exam:list"),
    get: (examId: string): Promise<MockExamDetail | null> =>
      ipcRenderer.invoke("mock-exam:get", examId),
    create: (input: CreateMockExamInput): Promise<MockExamDetail> =>
      ipcRenderer.invoke("mock-exam:create", input),
    start: (examId: string): Promise<MockExamDetail> =>
      ipcRenderer.invoke("mock-exam:start", examId),
    submit: (examId: string): Promise<MockExamDetail> =>
      ipcRenderer.invoke("mock-exam:submit", examId),
  },
  adaptive: {
    getProfile: (): Promise<AdaptiveTrainingProfile> =>
      ipcRenderer.invoke("adaptive:get-profile"),
    saveNode: (input: SaveKnowledgeNodeInput) =>
      ipcRenderer.invoke("adaptive:save-node", input),
    saveEdge: (input: SaveKnowledgeEdgeInput) =>
      ipcRenderer.invoke("adaptive:save-edge", input),
    saveItemParameter: (input: SaveIrtItemParameterInput) =>
      ipcRenderer.invoke("adaptive:save-item-parameter", input),
  },
  assessment: {
    listSessions: (): Promise<PracticeSessionDetail[]> =>
      ipcRenderer.invoke("assessment:list-sessions"),
    listRecords: (): Promise<AssessmentRecordSummary[]> =>
      ipcRenderer.invoke("assessment:list-records"),
    getRecord: (assessmentId: string): Promise<AssessmentRecordDetail | null> =>
      ipcRenderer.invoke("assessment:get-record", assessmentId),
    getDashboard: (): Promise<AssessmentDashboard> =>
      ipcRenderer.invoke("assessment:get-dashboard"),
    saveManual: (input: SaveAssessmentInput): Promise<AssessmentRecordDetail> =>
      ipcRenderer.invoke("assessment:save-manual", input),
  },
  ai: {
    getProviderRegistry: (): Promise<AiProviderRegistry> =>
      ipcRenderer.invoke("ai:get-provider-registry"),
    saveProvider: (input: AiProviderConfigInput): Promise<AiProviderRegistry> =>
      ipcRenderer.invoke("ai:save-provider", input),
    setDefaultProvider: (providerId: string): Promise<AiProviderRegistry> =>
      ipcRenderer.invoke("ai:set-default-provider", providerId),
    removeProvider: (providerId: string): Promise<AiProviderRegistry> =>
      ipcRenderer.invoke("ai:remove-provider", providerId),
    testProvider: (providerId: string): Promise<AiConnectionResult> =>
      ipcRenderer.invoke("ai:test-provider", providerId),
    listModels: (providerId: string): Promise<AiConnectionResult> =>
      ipcRenderer.invoke("ai:list-models", providerId),
    prepareAssessment: (
      input: AiAssessmentPrepareInput
    ): Promise<AiAssessmentPreview> =>
      ipcRenderer.invoke("ai:prepare-assessment", input),
    runAssessment: (
      authorizationToken: string
    ): Promise<AiAssessmentRunResult> =>
      ipcRenderer.invoke("ai:run-assessment", authorizationToken),
    prepareTutor: (input: TutorPrepareInput): Promise<TutorPreview> =>
      ipcRenderer.invoke("ai:prepare-tutor", input),
    runTutor: (authorizationToken: string): Promise<TutorSession> =>
      ipcRenderer.invoke("ai:run-tutor", authorizationToken),
    askTutor: (input: {
      sessionId: string;
      message: string;
    }): Promise<TutorSession> => ipcRenderer.invoke("ai:ask-tutor", input),
    autoReviewAll: (): Promise<AutoReviewSummary> =>
      ipcRenderer.invoke("ai:auto-review-all"),
    generateVariants: (
      input: VariantGenerateInput
    ): Promise<QuestionBankQuestion[]> =>
      ipcRenderer.invoke("ai:generate-variants", input),
    composeMockExam: (
      input?: MockExamComposeInput
    ): Promise<{
      exam: MockExamDetail;
      rationale: string;
      providerLabel: string;
      model: string;
    }> => ipcRenderer.invoke("ai:compose-mock-exam", input ?? {}),
    getProviderStatus: async (): Promise<AiProviderStatus> =>
      toDefaultStatus(await ipcRenderer.invoke("ai:get-provider-registry")),
    saveProviderConfig: async (
      input: Omit<AiProviderConfigInput, "enabled">
    ): Promise<AiProviderStatus> =>
      toDefaultStatus(
        await ipcRenderer.invoke("ai:save-provider", {
          ...input,
          enabled: true,
        })
      ),
    removeProviderConfig: async (): Promise<AiProviderStatus> => {
      const registry = (await ipcRenderer.invoke(
        "ai:get-provider-registry"
      )) as AiProviderRegistry;
      const provider = registry.providers.find(item => item.isDefault);
      return toDefaultStatus(
        provider
          ? await ipcRenderer.invoke("ai:remove-provider", provider.id)
          : registry
      );
    },
  },
  practice: {
    saveResponse: (
      input: SavePracticeResponseInput
    ): Promise<PracticeSessionDetail> =>
      ipcRenderer.invoke("practice:save-response", input),
    selectPaperAttachments: (input: {
      sessionId?: string;
      referenceKey: string;
      title: string;
    }): Promise<{ session?: PracticeSessionDetail; cancelled?: boolean }> =>
      ipcRenderer.invoke("practice:select-paper-attachments", input),
    saveInkResponse: (input: SaveInkResponseInput): Promise<InkSaveResult> =>
      ipcRenderer.invoke("practice:save-ink-response", input),
    getInkResponse: (responseId: string): Promise<InkResponseDetail | null> =>
      ipcRenderer.invoke("practice:get-ink-response", responseId),
  },
  backup: {
    export: (): Promise<BackupExportResult> =>
      ipcRenderer.invoke("backup:export"),
    selectForRestore: (): Promise<{
      selection?: BackupSelection;
      cancelled?: boolean;
    }> => ipcRenderer.invoke("backup:select-for-restore"),
    restore: (token: string): Promise<BackupSelection> =>
      ipcRenderer.invoke("backup:restore", token),
  },
  app: {
    openExternal: (url: string): Promise<void> =>
      ipcRenderer.invoke("app:open-external", url),
  },
});
