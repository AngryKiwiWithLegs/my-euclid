import { app, BrowserWindow, dialog, ipcMain, safeStorage, shell } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { archiveFiles, ensureArchiveDirectory, importFileFilters } from "./archive.js";
import { exportBackup, preflightBackup, restoreBackup } from "./backup.js";
import { createMockExam, databaseHealth, getAdaptiveTrainingProfile, getAssessmentDashboard, getAssessmentRecord, getDatabase, getInkResponse, getMockExam, getQuestionBankQuestion, listAssessmentRecords, listAssessmentSessions, listImportJobs, listMockExams, listQuestionBank, publishQuestionDrafts, saveAssessmentRecord, saveInkResponse, saveKnowledgeEdge, saveKnowledgeNode, saveQuestionIrtParameter, startMockExam, submitMockExam } from "./database.js";
import { getReviewDocument, listReviewDocuments, saveQuestionDrafts, updatePageOcr } from "./database.js";
import { getReviewPagePreview, recognizeReviewRegion } from "./review-media.js";
import { getAiProviderRegistry, removeAiProvider, saveAiProvider, setDefaultAiProvider } from "./ai-config.js";
import { askTutorQuestion, listAiProviderModels, prepareAiAssessment, prepareTutorSession, runAuthorizedAiAssessment, runAuthorizedTutorSession, testAiProvider } from "./ai-runtime.js";
import { autoReviewAllDocuments, composeMockExamWithAi, generateVariantQuestions } from "./ai-authoring.js";
import { importResponseAttachments, responseFileFilters, saveResponse } from "./practice.js";
import type { AiAssessmentPrepareInput, AiProviderConfigInput, CreateMockExamInput, ImportKind, ImportResult, MockExamComposeInput, NormalizedRect, PublishQuestionDraftInput, QuestionBankFilter, QuestionDraft, SaveAssessmentInput, SaveInkResponseInput, SaveIrtItemParameterInput, SaveKnowledgeEdgeInput, SaveKnowledgeNodeInput, SavePracticeResponseInput, TutorPrepareInput, VariantGenerateInput } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDevelopment = Boolean(process.env.VITE_DEV_SERVER_URL);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireLocalId(value: unknown, label: string) {
  if (typeof value !== "string" || !uuidPattern.test(value)) throw new Error(`${label}无效。`);
  return value;
}

function requireNormalizedRect(value: unknown): NormalizedRect {
  if (!value || typeof value !== "object") throw new Error("框选区域无效。");
  const rect = value as Record<string, unknown>;
  const numbers = [rect.x, rect.y, rect.width, rect.height];
  if (!numbers.every(number => typeof number === "number" && Number.isFinite(number))) throw new Error("框选区域包含无效坐标。");
  const [x, y, width, height] = numbers as number[];
  if (x < 0 || y < 0 || width < 0.01 || height < 0.01 || width > 1 || height > 1 || x + width > 1 || y + height > 1) throw new Error("框选区域超出原始页面边界。");
  return { x, y, width, height };
}

function requireAssessment(input: unknown): SaveAssessmentInput {
  if (!input || typeof input !== "object") throw new Error("评分档案参数无效。");
  const data = input as SaveAssessmentInput;
  if (!uuidPattern.test(data.sessionId) || !uuidPattern.test(data.responseId) || !["draft", "confirmed"].includes(data.status)) throw new Error("评分档案的会话、答卷或状态无效。");
  if (!Number.isFinite(data.scoreAwarded) || !Number.isFinite(data.scoreMaximum) || data.scoreAwarded < 0 || data.scoreMaximum <= 0 || data.scoreAwarded > data.scoreMaximum) throw new Error("总分必须介于 0 与满分之间。");
  if (typeof data.overallFeedback !== "string" || typeof data.summary !== "string" || data.overallFeedback.length > 12_000 || data.summary.length > 4_000) throw new Error("评分说明超过保存限制。");
  if (!Array.isArray(data.evidence) || !Array.isArray(data.mistakes) || !Array.isArray(data.modules) || data.evidence.length > 30 || data.mistakes.length > 20 || data.modules.length > 12) throw new Error("评分依据、错因或模块数量超过保存限制。");
  const validEvidence = data.evidence.every(item => typeof item?.criterion === "string" && typeof item.rationale === "string" && typeof item.responseQuote === "string" && Number.isFinite(item.maximumPoints) && Number.isFinite(item.awardedPoints) && item.maximumPoints >= 0 && item.awardedPoints >= 0 && item.awardedPoints <= item.maximumPoints);
  const validMistakes = data.mistakes.every(item => ["conceptual", "method", "reasoning", "completeness", "calculation", "communication", "time", "other"].includes(item?.category) && ["minor", "moderate", "major"].includes(item?.severity) && typeof item.module === "string" && typeof item.note === "string");
  const validModules = data.modules.every(item => typeof item?.module === "string" && typeof item.note === "string" && Number.isFinite(item.maximumPoints) && Number.isFinite(item.awardedPoints) && item.maximumPoints > 0 && item.awardedPoints >= 0 && item.awardedPoints <= item.maximumPoints);
  if (!validEvidence || !validMistakes || !validModules) throw new Error("评分依据、错因或模块字段无效。");
  return data;
}

function requireAiConfig(input: unknown): AiProviderConfigInput {
  if (!input || typeof input !== "object") throw new Error("AI 服务配置无效。");
  const value = input as AiProviderConfigInput;
  if (![value.providerLabel, value.baseUrl, value.model].every(field => typeof field === "string") || (value.apiKey !== undefined && typeof value.apiKey !== "string") || typeof value.enabled !== "boolean") throw new Error("AI 服务配置字段无效。");
  return value;
}

function requireAiAssessmentPrepare(input: unknown): AiAssessmentPrepareInput {
  if (!input || typeof input !== "object") throw new Error("AI 判卷授权参数无效。");
  const value = input as AiAssessmentPrepareInput;
  if (!uuidPattern.test(value.sessionId) || !uuidPattern.test(value.responseId) || typeof value.questionText !== "string" || !Number.isFinite(value.scoreMaximum)) throw new Error("AI 判卷授权字段无效。");
  return value;
}

function requireQuestionBankFilter(input: unknown): QuestionBankFilter {
  if (!input || typeof input !== "object") return {};
  const value = input as QuestionBankFilter;
  if (value.query !== undefined && (typeof value.query !== "string" || value.query.length > 200)) throw new Error("题库搜索条件无效。");
  if (value.competitionYear !== undefined && (!Number.isInteger(value.competitionYear) || value.competitionYear < 1900 || value.competitionYear > 2100)) throw new Error("竞赛年份无效。");
  if (value.difficulty !== undefined && (!Number.isFinite(value.difficulty) || value.difficulty < 1 || value.difficulty > 5)) throw new Error("难度筛选无效。");
  if (value.limit !== undefined && (!Number.isInteger(value.limit) || value.limit < 1 || value.limit > 500)) throw new Error("题库数量限制无效。");
  return value;
}

function requirePublishQuestionInputs(input: unknown): PublishQuestionDraftInput[] {
  if (!Array.isArray(input) || !input.length || input.length > 100) throw new Error("至少选择一道已确认题目发布，且一次不超过 100 题。");
  input.forEach(item => {
    if (!item || typeof item !== "object" || !uuidPattern.test((item as PublishQuestionDraftInput).questionDraftId)) throw new Error("题目发布标识无效。");
    const metadata = (item as PublishQuestionDraftInput).metadata;
    if (!metadata || typeof metadata.sourceName !== "string" || typeof metadata.primaryTopic !== "string" || typeof metadata.questionType !== "string" || !Array.isArray(metadata.secondaryTopics) || !Array.isArray(metadata.methods) || !Array.isArray(metadata.tags) || !Array.isArray(metadata.subquestions)) throw new Error("题目发布元数据无效。");
  });
  return input as PublishQuestionDraftInput[];
}

function requireCreateMockExam(input: unknown): CreateMockExamInput {
  if (!input || typeof input !== "object") throw new Error("模考创建参数无效。");
  const value = input as CreateMockExamInput;
  if (typeof value.title !== "string" || !Array.isArray(value.questionIds) || value.questionIds.some(id => !uuidPattern.test(id)) || (value.durationSeconds !== undefined && (!Number.isInteger(value.durationSeconds) || value.durationSeconds < 60 || value.durationSeconds > 21600))) throw new Error("模考试卷字段无效。");
  return value;
}

function requireKnowledgeNode(input: unknown): SaveKnowledgeNodeInput {
  if (!input || typeof input !== "object") throw new Error("知识节点参数无效。"); const value = input as SaveKnowledgeNodeInput;
  if (typeof value.name !== "string" || typeof value.description !== "string" || (value.id !== undefined && !uuidPattern.test(value.id))) throw new Error("知识节点字段无效。"); return value;
}
function requireKnowledgeEdge(input: unknown): SaveKnowledgeEdgeInput {
  if (!input || typeof input !== "object") throw new Error("知识依赖参数无效。"); const value = input as SaveKnowledgeEdgeInput;
  if (!uuidPattern.test(value.prerequisiteNodeId) || !uuidPattern.test(value.dependentNodeId) || (value.id !== undefined && !uuidPattern.test(value.id)) || !Number.isFinite(value.strength)) throw new Error("知识依赖字段无效。"); return value;
}
function requireIrtParameter(input: unknown): SaveIrtItemParameterInput {
  if (!input || typeof input !== "object") throw new Error("IRT 参数无效。"); const value = input as SaveIrtItemParameterInput;
  if (!uuidPattern.test(value.questionId) || !Array.isArray(value.nodeIds) || value.nodeIds.some(id => !uuidPattern.test(id)) || !["manual", "heuristic"].includes(value.source) || !Number.isFinite(value.difficulty) || !Number.isFinite(value.discrimination) || !Number.isFinite(value.guessing)) throw new Error("IRT 参数字段无效。"); return value;
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 980,
    minWidth: 1120,
    minHeight: 720,
    backgroundColor: "#F5F0E5",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  if (isDevelopment) window.loadURL(process.env.VITE_DEV_SERVER_URL!);
  else window.loadFile(path.join(app.getAppPath(), "dist", "public", "index.html"));
  return window;
}

app.whenReady().then(async () => {
  getDatabase(app);
  await ensureArchiveDirectory(app);
  ipcMain.handle("archive:get-health", () => databaseHealth(app, true));
  ipcMain.handle("archive:list-import-jobs", () => listImportJobs(app));
  ipcMain.handle("review:list-documents", () => listReviewDocuments(app));
  ipcMain.handle("review:get-document", (_event, sourceDocumentId: string) => getReviewDocument(app, requireLocalId(sourceDocumentId, "资料标识")));
  ipcMain.handle("review:get-page-preview", (_event, pageId: string) => getReviewPagePreview(app, requireLocalId(pageId, "页面标识")));
  ipcMain.handle("review:recognize-region", async (_event, input: { pageId: string; rect: NormalizedRect }) => recognizeReviewRegion(app, requireLocalId(input?.pageId, "页面标识"), requireNormalizedRect(input?.rect)));
  ipcMain.handle("review:update-page-ocr", (_event, pageId: string, ocrText: string) => {
    if (typeof ocrText !== "string" || ocrText.length > 500_000) throw new Error("OCR 文本无效或超过保存限制。");
    return updatePageOcr(app, requireLocalId(pageId, "页面标识"), ocrText);
  });
  ipcMain.handle("review:save-question-drafts", (_event, sourceDocumentId: string, questions: QuestionDraft[]) => saveQuestionDrafts(app, sourceDocumentId, questions));
  ipcMain.handle("review:publish-question-drafts", (_event, sourceDocumentId: string, inputs: PublishQuestionDraftInput[]) => publishQuestionDrafts(app, requireLocalId(sourceDocumentId, "资料标识"), requirePublishQuestionInputs(inputs)));
  ipcMain.handle("library:list-questions", (_event, filter: QuestionBankFilter) => listQuestionBank(app, requireQuestionBankFilter(filter)));
  ipcMain.handle("library:get-question", (_event, questionId: string) => getQuestionBankQuestion(app, requireLocalId(questionId, "题库题目标识")));
  ipcMain.handle("mock-exam:list", () => listMockExams(app));
  ipcMain.handle("mock-exam:get", (_event, examId: string) => getMockExam(app, requireLocalId(examId, "模考标识")));
  ipcMain.handle("mock-exam:create", (_event, input: CreateMockExamInput) => createMockExam(app, requireCreateMockExam(input)));
  ipcMain.handle("mock-exam:start", (_event, examId: string) => startMockExam(app, requireLocalId(examId, "模考标识")));
  ipcMain.handle("mock-exam:submit", (_event, examId: string) => submitMockExam(app, requireLocalId(examId, "模考标识")));
  ipcMain.handle("adaptive:get-profile", () => getAdaptiveTrainingProfile(app));
  ipcMain.handle("adaptive:save-node", (_event, input: SaveKnowledgeNodeInput) => saveKnowledgeNode(app, requireKnowledgeNode(input)));
  ipcMain.handle("adaptive:save-edge", (_event, input: SaveKnowledgeEdgeInput) => saveKnowledgeEdge(app, requireKnowledgeEdge(input)));
  ipcMain.handle("adaptive:save-item-parameter", (_event, input: SaveIrtItemParameterInput) => saveQuestionIrtParameter(app, requireIrtParameter(input)));
  ipcMain.handle("assessment:list-sessions", () => listAssessmentSessions(app));
  ipcMain.handle("assessment:list-records", () => listAssessmentRecords(app));
  ipcMain.handle("assessment:get-record", (_event, assessmentId: string) => getAssessmentRecord(app, requireLocalId(assessmentId, "评分档案标识")));
  ipcMain.handle("assessment:get-dashboard", () => getAssessmentDashboard(app));
  ipcMain.handle("assessment:save-manual", (_event, input: SaveAssessmentInput) => saveAssessmentRecord(app, requireAssessment(input)));
  ipcMain.handle("ai:get-provider-registry", () => getAiProviderRegistry(app, safeStorage));
  ipcMain.handle("ai:save-provider", (_event, input: AiProviderConfigInput) => saveAiProvider(app, safeStorage, requireAiConfig(input)));
  ipcMain.handle("ai:set-default-provider", (_event, providerId: string) => setDefaultAiProvider(app, safeStorage, requireLocalId(providerId, "AI 服务标识")));
  ipcMain.handle("ai:remove-provider", (_event, providerId: string) => removeAiProvider(app, safeStorage, requireLocalId(providerId, "AI 服务标识")));
  ipcMain.handle("ai:test-provider", (_event, providerId: string) => testAiProvider(app, safeStorage, requireLocalId(providerId, "AI 服务标识")));
  ipcMain.handle("ai:list-models", (_event, providerId: string) => listAiProviderModels(app, safeStorage, requireLocalId(providerId, "AI 服务标识")));
  ipcMain.handle("ai:auto-review-all", async () => autoReviewAllDocuments(app, safeStorage));
  ipcMain.handle("ai:generate-variants", (_event, input: VariantGenerateInput) => {
    if (!input || typeof input.questionId !== "string" || !uuidPattern.test(input.questionId)) throw new Error("变式题目标识无效。");
    if (input.count !== undefined && (!Number.isInteger(input.count) || input.count < 1 || input.count > 5)) throw new Error("变式数量必须为 1 到 5。");
    return generateVariantQuestions(app, safeStorage, { questionId: input.questionId, count: input.count });
  });
  ipcMain.handle("ai:compose-mock-exam", (_event, input?: MockExamComposeInput) => {
    if (input !== undefined && input !== null && typeof input !== "object") throw new Error("AI 组卷参数无效。");
    if (input?.title !== undefined && (typeof input.title !== "string" || input.title.trim().length > 200)) throw new Error("试卷标题无效。");
    return composeMockExamWithAi(app, safeStorage, { title: typeof input?.title === "string" ? input.title : undefined });
  });
  ipcMain.handle("ai:prepare-assessment", (_event, input: AiAssessmentPrepareInput) => prepareAiAssessment(app, safeStorage, requireAiAssessmentPrepare(input)));
  ipcMain.handle("ai:run-assessment", (_event, authorizationToken: string) => {
    if (typeof authorizationToken !== "string" || !uuidPattern.test(authorizationToken)) throw new Error("AI 判卷授权标识无效。");
    return runAuthorizedAiAssessment(app, safeStorage, authorizationToken);
  });
  ipcMain.handle("ai:prepare-tutor", (_event, input: TutorPrepareInput) => {
    if (!input || typeof input.questionId !== "string" || !uuidPattern.test(input.questionId)) throw new Error("互动讲解题目标识无效。");
    return prepareTutorSession(app, safeStorage, { questionId: input.questionId });
  });
  ipcMain.handle("ai:run-tutor", (_event, authorizationToken: string) => {
    if (typeof authorizationToken !== "string" || !uuidPattern.test(authorizationToken)) throw new Error("互动讲解授权标识无效。");
    return runAuthorizedTutorSession(app, safeStorage, authorizationToken);
  });
  ipcMain.handle("ai:ask-tutor", (_event, input: { sessionId: string; message: string }) => {
    if (!input || typeof input.message !== "string" || input.message.length > 20_000) throw new Error("互动讲解追问无效。");
    return askTutorQuestion(app, safeStorage, requireLocalId(input.sessionId, "互动讲解会话标识"), input.message);
  });
  ipcMain.handle("practice:save-response", (_event, input: SavePracticeResponseInput) => {
    if (!input || !["keyboard", "handwritten"].includes(input.answerFormat) || !["draft", "submitted"].includes(input.status)) throw new Error("作答格式或保存状态无效。");
    if (input.content.length > 500_000) throw new Error("单次作答文本超过保存限制。");
    return saveResponse(app, input);
  });
  ipcMain.handle("practice:save-ink-response", (_event, input: SaveInkResponseInput) => {
    if (!input || !["draft", "submitted"].includes(input.status) || !Number.isFinite(input.canvasWidth) || !Number.isFinite(input.canvasHeight)) throw new Error("笔迹保存参数无效。");
    if (input.layers.length > 16 || input.layers.reduce((count, layer) => count + layer.strokes.length, 0) > 4_000) throw new Error("笔迹图层或笔画数量超过本地保存限制。");
    if (input.layers.some(layer => layer.strokes.some(stroke => stroke.points.length > 10_000 || stroke.points.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(point.t))))) throw new Error("笔迹点序列包含无效数据。");
    return saveInkResponse(app, input);
  });
  ipcMain.handle("practice:get-ink-response", (_event, responseId: string) => getInkResponse(app, responseId));
  ipcMain.handle("practice:select-paper-attachments", async (_event, input: { sessionId?: string; referenceKey: string; title: string }) => {
    const result = await dialog.showOpenDialog({ title: "选择纸质答案附件", buttonLabel: "归档到当前作答", filters: responseFileFilters, properties: ["openFile", "multiSelections"] });
    if (result.canceled) return { cancelled: true };
    return { session: await importResponseAttachments(app, { ...input, filePaths: result.filePaths }) };
  });
  ipcMain.handle("archive:select-and-import", async (_event, kind: ImportKind): Promise<ImportResult> => {
    if (kind !== "source_document" && kind !== "paper_response") throw new Error("不支持的导入类型。");
    const result = await dialog.showOpenDialog({
      title: kind === "paper_response" ? "选择纸质答卷扫描件或照片" : "选择题目资料",
      buttonLabel: "归档并创建审核任务",
      filters: importFileFilters,
      properties: ["openFile", "multiSelections"],
    });
    if (result.canceled) return { jobs: [], cancelled: true };
    return { jobs: await archiveFiles(app, result.filePaths, kind) };
  });
  ipcMain.handle("backup:export", async () => {
    const result = await dialog.showSaveDialog({ title: "导出 My Euclid 本地备份", defaultPath: `My-Euclid-${new Date().toISOString().slice(0, 10)}.myeuclid-backup.zip`, filters: [{ name: "My Euclid 备份包", extensions: ["zip"] }] });
    if (result.canceled || !result.filePath) return { cancelled: true };
    return exportBackup(app, result.filePath);
  });
  ipcMain.handle("backup:select-for-restore", async () => {
    const result = await dialog.showOpenDialog({ title: "选择 My Euclid 备份包", filters: [{ name: "My Euclid 备份包", extensions: ["zip"] }], properties: ["openFile"] });
    if (result.canceled || !result.filePaths[0]) return { cancelled: true };
    return { selection: await preflightBackup(app, result.filePaths[0]) };
  });
  ipcMain.handle("backup:restore", async (_event, token: string) => restoreBackup(app, token));
  ipcMain.handle("app:open-external", async (_event, url: string) => {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") throw new Error("只允许打开 HTTPS 链接。");
    await shell.openExternal(parsed.toString());
  });
  createWindow();
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
