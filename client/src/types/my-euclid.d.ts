export {};

declare global {
  type MyEuclidImportKind = "source_document" | "paper_response";
  type MyEuclidImportStatus = "queued" | "archived" | "needs_review" | "failed";
  interface MyEuclidImportJob { id: string; sourceDocumentId: string; originalName: string; kind: MyEuclidImportKind; status: MyEuclidImportStatus; createdAt: string; errorMessage?: string; }
  interface MyEuclidArchiveHealth { mode: "desktop"; databaseReady: boolean; archiveReady: boolean; documentCount: number; pendingReviewCount: number; }
  type MyEuclidOcrStatus = "pending" | "extracted" | "failed" | "reviewed";
  type MyEuclidReviewStatus = "needs_review" | "confirmed";
  interface MyEuclidNormalizedRect { x: number; y: number; width: number; height: number; }
  interface MyEuclidOcrRegion { id: string; pageId: string; rect: MyEuclidNormalizedRect; ocrText: string; ocrStatus: MyEuclidOcrStatus; createdAt: string; }
  interface MyEuclidReviewPagePreview { pageId: string; pageNumber: number; available: boolean; sourceKind: "pdf" | "image" | "text"; dataUrl?: string; width?: number; height?: number; reason?: string; }
  interface MyEuclidReviewPage { id: string; pageNumber: number; ocrText: string; ocrStatus: MyEuclidOcrStatus; reviewStatus: MyEuclidReviewStatus; regions: MyEuclidOcrRegion[]; }
  interface MyEuclidSubquestionDraft { id?: string; label: string; text: string; ordinal: number; }
  interface MyEuclidQuestionDraft { id?: string; pageId: string; label: string; title: string; promptText: string; ordinal: number; subquestions: MyEuclidSubquestionDraft[]; }
  interface MyEuclidReviewDocumentSummary { sourceDocumentId: string; originalName: string; kind: MyEuclidImportKind; importedAt: string; pageCount: number; reviewStatus: MyEuclidReviewStatus; }
  interface MyEuclidReviewDocumentDetail extends MyEuclidReviewDocumentSummary { pages: MyEuclidReviewPage[]; questions: MyEuclidQuestionDraft[]; }
  type MyEuclidQuestionBankStatus = "published" | "archived";
  interface MyEuclidQuestionTag { id: string; category: string; value: string; source: "manual" | "ai_suggestion"; }
  interface MyEuclidQuestionBankSubquestion { id: string; sourceSubquestionDraftId?: string; ordinal: number; label: string; promptText: string; maximumPoints?: number; }
  interface MyEuclidQuestionBankQuestion { id: string; sourceQuestionDraftId: string; sourceDocumentId: string; pageId: string; originalName: string; pageNumber: number; label: string; title: string; promptText: string; status: MyEuclidQuestionBankStatus; sourceName: string; competitionYear?: number; questionNumber?: number; primaryTopic: string; secondaryTopics: string[]; difficulty?: number; questionType: string; methods: string[]; proofRequired: boolean; estimatedMinutes?: number; maximumPoints?: number; scoringNotes: string; priority: number; tags: MyEuclidQuestionTag[]; subquestions: MyEuclidQuestionBankSubquestion[]; createdAt: string; updatedAt: string; }
  interface MyEuclidQuestionPublishInput { questionDraftId: string; metadata: { sourceName: string; competitionYear?: number; questionNumber?: number; primaryTopic: string; secondaryTopics: string[]; difficulty?: number; questionType: string; methods: string[]; proofRequired: boolean; estimatedMinutes?: number; maximumPoints?: number; scoringNotes: string; priority: number; tags: Array<{ category: string; value: string; source?: "manual" | "ai_suggestion" }>; subquestions: Array<{ sourceSubquestionDraftId?: string; ordinal: number; label: string; promptText: string; maximumPoints?: number; }>; }; }
  type MyEuclidMockExamStatus = "draft" | "active" | "submitted" | "archived";
  interface MyEuclidMockExamItem { id: string; ordinal: number; questionId: string; maximumPoints?: number; title: string; label: string; promptText: string; primaryTopic: string; difficulty?: number; sessionId: string; responseCount: number; submittedResponseCount: number; }
  interface MyEuclidMockExam { id: string; title: string; status: MyEuclidMockExamStatus; durationSeconds: number; questionCount: number; startedAt?: string; submittedAt?: string; createdAt: string; updatedAt: string; items: MyEuclidMockExamItem[]; }
  interface MyEuclidKnowledgeNode { id: string; name: string; description: string; createdAt: string; updatedAt: string; }
  interface MyEuclidKnowledgeEdge { id: string; prerequisiteNodeId: string; dependentNodeId: string; strength: number; }
  interface MyEuclidIrtItemParameter { questionId: string; difficulty: number; discrimination: number; guessing: number; source: "manual" | "heuristic"; updatedAt: string; }
  interface MyEuclidAbilitySnapshot { nodeId: string; theta: number; standardError: number; evidenceCount: number; updatedAt: string; }
  interface MyEuclidAdaptiveRecommendation { question: MyEuclidQuestionBankQuestion; reason: "upstream" | "weakness" | "stretch" | "review"; predictedProbability: number; targetNodeId: string; targetNodeName: string; }
  interface MyEuclidAdaptiveProfile { nodes: MyEuclidKnowledgeNode[]; edges: MyEuclidKnowledgeEdge[]; mappings: Array<{ questionId: string; nodeId: string; weight: number }>; parameters: MyEuclidIrtItemParameter[]; abilities: MyEuclidAbilitySnapshot[]; recommendations: MyEuclidAdaptiveRecommendation[]; notice: string; }
  type MyEuclidAnswerFormat = "keyboard" | "handwritten" | "paper_attachment";
  interface MyEuclidResponseAttachment { id: string; responseId: string; originalName: string; mimeType: string; sizeBytes: number; createdAt: string; }
  interface MyEuclidPracticeResponse { id: string; sessionId: string; answerFormat: MyEuclidAnswerFormat; content: string; status: "draft" | "submitted"; version: number; createdAt: string; attachments: MyEuclidResponseAttachment[]; }
  interface MyEuclidPracticeSession { id: string; referenceKey: string; title: string; status: "active" | "submitted" | "archived"; startedAt: string; updatedAt: string; responses: MyEuclidPracticeResponse[]; }
  interface MyEuclidBackupSummary { backupId: string; createdAt: string; documentCount: number; responseCount: number; attachmentCount: number; fileCount: number; }
  interface MyEuclidBackupSelection extends MyEuclidBackupSummary { token: string; fileName: string; }
  interface MyEuclidBackupExport extends MyEuclidBackupSummary { outputName: string; cancelled?: boolean; }
  interface MyEuclidInkPoint { x: number; y: number; pressure: number; t: number; }
  interface MyEuclidInkStroke { id?: string; ordinal: number; tool: "pen" | "eraser"; color: string; width: number; points: MyEuclidInkPoint[]; }
  interface MyEuclidInkLayer { id?: string; title: string; ordinal: number; visible: boolean; strokes: MyEuclidInkStroke[]; }
  interface MyEuclidInkResponse { responseId: string; sessionId: string; canvasWidth: number; canvasHeight: number; previewSvg: string; createdAt: string; layers: Array<MyEuclidInkLayer & { id: string; strokes: Array<MyEuclidInkStroke & { id: string }> }>; }
  type MyEuclidAssessmentStatus = "draft" | "confirmed";
  type MyEuclidMistakeCategory = "conceptual" | "method" | "reasoning" | "completeness" | "calculation" | "communication" | "time" | "other";
  type MyEuclidMistakeSeverity = "minor" | "moderate" | "major";
  interface MyEuclidAssessmentEvidence { id?: string; criterion: string; maximumPoints: number; awardedPoints: number; rationale: string; responseQuote: string; ordinal: number; }
  interface MyEuclidAssessmentMistake { id?: string; category: MyEuclidMistakeCategory; module: string; severity: MyEuclidMistakeSeverity; note: string; ordinal: number; }
  interface MyEuclidAssessmentModule { id?: string; module: string; awardedPoints: number; maximumPoints: number; note: string; ordinal: number; }
  interface MyEuclidAssessmentRecord { id: string; sessionId: string; responseId: string; referenceKey: string; title: string; responseVersion: number; answerFormat: MyEuclidAnswerFormat; origin: "manual" | "ai"; status: MyEuclidAssessmentStatus; version: number; scoreAwarded: number; scoreMaximum: number; overallFeedback: string; summary: string; createdAt: string; confirmedAt?: string; }
  interface MyEuclidAssessmentDetail extends MyEuclidAssessmentRecord { evidence: Array<MyEuclidAssessmentEvidence & { id: string }>; mistakes: Array<MyEuclidAssessmentMistake & { id: string }>; modules: Array<MyEuclidAssessmentModule & { id: string }>; }
  interface MyEuclidAssessmentDashboard { assessmentCount: number; confirmedCount: number; weightedScoreRate: number | null; latestScoreRate: number | null; recentAssessments: MyEuclidAssessmentRecord[]; history: Array<{ assessmentId: string; createdAt: string; scoreRate: number }>; modules: Array<{ module: string; awardedPoints: number; maximumPoints: number; scoreRate: number }>; mistakes: Array<{ category: MyEuclidMistakeCategory; count: number }>; aiStatus: "not_configured"; }
  interface MyEuclidAiProviderStatus { configured: boolean; secureStorageAvailable: boolean; providerLabel?: string; baseUrl?: string; model?: string; updatedAt?: string; requiresPerRequestApproval: true; message: string; }
  interface MyEuclidAiProviderSummary { id: string; providerLabel: string; baseUrl: string; model: string; enabled: boolean; isDefault: boolean; createdAt: string; updatedAt: string; }
  interface MyEuclidAiProviderRegistry { secureStorageAvailable: boolean; providers: MyEuclidAiProviderSummary[]; defaultProviderId?: string; requiresPerRequestApproval: true; message: string; }
  interface MyEuclidAiConnectionResult { providerId: string; ok: boolean; latencyMs: number; models: string[]; message: string; }
  interface MyEuclidAiAssessmentPreview { authorizationToken: string; expiresAt: string; providerId: string; providerLabel: string; model: string; sessionTitle: string; referenceKey: string; answerFormat: "keyboard" | "handwritten" | "paper_attachment"; questionText: string; answerText: string; scoreMaximum: number; attachments: MyEuclidResponseAttachment[]; disclosure: string[]; }
  interface MyEuclidAiAssessmentRunResult { auditId: string; assessment: MyEuclidAssessmentDetail; providerLabel: string; model: string; responseExcerpt: string; }
  interface MyEuclidTutorPlan { prerequisiteKnowledge: string[]; entryPoint: string; thoughtSource: string; methods: Array<{ name: string; outline: string; keyIdea: string; pitfalls: string }>; similarType: string; variants: string[]; socraticQuestion: string; }
  interface MyEuclidTutorSession { id: string; questionId: string; providerId: string; status: "active" | "archived"; questionText: string; answerText: string; plan?: MyEuclidTutorPlan; createdAt: string; updatedAt: string; messages: Array<{ id: string; role: "user" | "assistant"; content: string; createdAt: string; }>; }
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
        getPagePreview: (pageId: string) => Promise<MyEuclidReviewPagePreview>;
        recognizeRegion: (input: { pageId: string; rect: MyEuclidNormalizedRect }) => Promise<MyEuclidOcrRegion>;
        updatePageOcr: (pageId: string, ocrText: string) => Promise<void>;
        saveQuestionDrafts: (sourceDocumentId: string, questions: MyEuclidQuestionDraft[]) => Promise<void>;
        publishQuestionDrafts: (sourceDocumentId: string, inputs: MyEuclidQuestionPublishInput[]) => Promise<MyEuclidQuestionBankQuestion[]>;
      };
      library: {
        listQuestions: (filter?: { query?: string; sourceName?: string; competitionYear?: number; primaryTopic?: string; difficulty?: number; questionType?: string; proofRequired?: boolean; limit?: number; }) => Promise<MyEuclidQuestionBankQuestion[]>;
        getQuestion: (questionId: string) => Promise<MyEuclidQuestionBankQuestion | null>;
      };
      mockExam: {
        list: () => Promise<MyEuclidMockExam[]>;
        get: (examId: string) => Promise<MyEuclidMockExam | null>;
        create: (input: { title: string; questionIds: string[]; durationSeconds?: number }) => Promise<MyEuclidMockExam>;
        start: (examId: string) => Promise<MyEuclidMockExam>;
        submit: (examId: string) => Promise<MyEuclidMockExam>;
      };
      adaptive: {
        getProfile: () => Promise<MyEuclidAdaptiveProfile>;
        saveNode: (input: { id?: string; name: string; description: string }) => Promise<MyEuclidKnowledgeNode>;
        saveEdge: (input: { id?: string; prerequisiteNodeId: string; dependentNodeId: string; strength: number }) => Promise<MyEuclidKnowledgeEdge>;
        saveItemParameter: (input: { questionId: string; difficulty: number; discrimination: number; guessing: number; source: "manual" | "heuristic"; nodeIds: string[] }) => Promise<MyEuclidIrtItemParameter>;
      };
      assessment: {
        listSessions: () => Promise<MyEuclidPracticeSession[]>;
        listRecords: () => Promise<MyEuclidAssessmentRecord[]>;
        getRecord: (assessmentId: string) => Promise<MyEuclidAssessmentDetail | null>;
        getDashboard: () => Promise<MyEuclidAssessmentDashboard>;
        saveManual: (input: { sessionId: string; responseId: string; status: MyEuclidAssessmentStatus; scoreAwarded: number; scoreMaximum: number; overallFeedback: string; summary: string; evidence: MyEuclidAssessmentEvidence[]; mistakes: MyEuclidAssessmentMistake[]; modules: MyEuclidAssessmentModule[] }) => Promise<MyEuclidAssessmentDetail>;
      };
      ai: {
        getProviderRegistry: () => Promise<MyEuclidAiProviderRegistry>;
        saveProvider: (input: { id?: string; providerLabel: string; baseUrl: string; model: string; apiKey?: string; enabled: boolean }) => Promise<MyEuclidAiProviderRegistry>;
        setDefaultProvider: (providerId: string) => Promise<MyEuclidAiProviderRegistry>;
        removeProvider: (providerId: string) => Promise<MyEuclidAiProviderRegistry>;
        testProvider: (providerId: string) => Promise<MyEuclidAiConnectionResult>;
        listModels: (providerId: string) => Promise<MyEuclidAiConnectionResult>;
        prepareAssessment: (input: { sessionId: string; responseId: string; questionText: string; scoreMaximum: number }) => Promise<MyEuclidAiAssessmentPreview>;
        runAssessment: (authorizationToken: string) => Promise<MyEuclidAiAssessmentRunResult>;
        prepareTutor: (input: { questionId: string }) => Promise<{ authorizationToken: string; expiresAt: string; providerLabel: string; model: string; questionId: string; questionText: string; answerText: string; disclosure: string[] }>;
        runTutor: (authorizationToken: string) => Promise<MyEuclidTutorSession>;
        askTutor: (input: { sessionId: string; message: string }) => Promise<MyEuclidTutorSession>;
        getProviderStatus: () => Promise<MyEuclidAiProviderStatus>;
        saveProviderConfig: (input: { providerLabel: string; baseUrl: string; model: string; apiKey: string }) => Promise<MyEuclidAiProviderStatus>;
        removeProviderConfig: () => Promise<MyEuclidAiProviderStatus>;
      };
      practice: {
        saveResponse: (input: { sessionId?: string; referenceKey: string; title: string; answerFormat: "keyboard" | "handwritten"; content: string; status: "draft" | "submitted" }) => Promise<MyEuclidPracticeSession>;
        selectPaperAttachments: (input: { sessionId?: string; referenceKey: string; title: string }) => Promise<{ session?: MyEuclidPracticeSession; cancelled?: boolean }>;
        saveInkResponse: (input: { sessionId?: string; referenceKey: string; title: string; status: "draft" | "submitted"; canvasWidth: number; canvasHeight: number; previewSvg: string; layers: MyEuclidInkLayer[] }) => Promise<{ session: MyEuclidPracticeSession; ink: MyEuclidInkResponse }>;
        getInkResponse: (responseId: string) => Promise<MyEuclidInkResponse | null>;
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
