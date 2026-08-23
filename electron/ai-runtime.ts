import { randomUUID } from "node:crypto";
import type { App } from "electron";
import { getAiProviderForUse, type SecureStringStorage } from "./ai-config.js";
import { createAiRunAudit, getPracticeSession, saveAiAssessmentDraft, updateAiRunAudit } from "./database.js";
import type { AiAssessmentPrepareInput, AiAssessmentPreview, AiAssessmentRunResult, AiConnectionResult, AssessmentMistakeInput, AssessmentModuleInput, AssessmentEvidenceInput, SaveAssessmentInput } from "./types.js";

type AuthorizedAssessment = AiAssessmentPreview & { responseId: string; sessionId: string; providerId: string; };
const authorizations = new Map<string, AuthorizedAssessment>();
const validCategories = new Set(["conceptual", "method", "reasoning", "completeness", "calculation", "communication", "time", "other"]);
const validSeverities = new Set(["minor", "moderate", "major"]);

function apiUrl(baseUrl: string, route: string) { return `${baseUrl.replace(/\/$/, "")}${route}`; }
function safeFailure(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") return "请求超时，未保存评分草案。";
  if (error instanceof Error && (error.message.startsWith("服务返回 HTTP") || error.message.startsWith("AI ") || error.message.includes("评分 JSON") || error.message.includes("评分依据") || error.message.includes("错因类别") || error.message.includes("模块拆分"))) return error.message;
  return "AI 服务请求失败，未保存评分草案。";
}
async function requestModels(baseUrl: string, apiKey: string) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(apiUrl(baseUrl, "/models"), { headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" }, signal: controller.signal });
    if (!response.ok) throw new Error(`服务返回 HTTP ${response.status}。`);
    const json = await response.json() as { data?: Array<{ id?: unknown }> };
    const models = Array.isArray(json.data) ? json.data.map(item => typeof item?.id === "string" ? item.id : "").filter(Boolean).slice(0, 200) : [];
    return models;
  } finally { clearTimeout(timer); }
}

export async function testAiProvider(app: App, storage: SecureStringStorage, providerId: string, platform?: NodeJS.Platform): Promise<AiConnectionResult> {
  const provider = await getAiProviderForUse(app, storage, providerId, platform);
  const started = Date.now();
  try {
    const models = await requestModels(provider.baseUrl, provider.apiKey);
    return { providerId, ok: true, latencyMs: Date.now() - started, models, message: models.length ? `已发现 ${models.length} 个模型。` : "服务连接成功，但未返回可识别的模型标识。" };
  } catch (error) { return { providerId, ok: false, latencyMs: Date.now() - started, models: [], message: safeFailure(error) }; }
}

export async function listAiProviderModels(app: App, storage: SecureStringStorage, providerId: string, platform?: NodeJS.Platform): Promise<AiConnectionResult> { return testAiProvider(app, storage, providerId, platform); }

export async function prepareAiAssessment(app: App, storage: SecureStringStorage, input: AiAssessmentPrepareInput, platform?: NodeJS.Platform): Promise<AiAssessmentPreview> {
  const session = getPracticeSession(app, input.sessionId);
  const response = session?.responses.find(item => item.id === input.responseId);
  if (!session || !response) throw new Error("要评阅的答卷版本不存在或不属于当前训练会话。");
  if (!input.questionText.trim() || input.questionText.length > 50_000 || !Number.isFinite(input.scoreMaximum) || input.scoreMaximum <= 0 || input.scoreMaximum > 1_000) throw new Error("题面或满分范围无效。");
  const provider = await getAiProviderForUse(app, storage, undefined, platform);
  const token = randomUUID(); const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
  const preview: AiAssessmentPreview = { authorizationToken: token, expiresAt, providerId: provider.id, providerLabel: provider.providerLabel, model: provider.model, sessionTitle: session.title, referenceKey: session.referenceKey, answerFormat: response.answerFormat, questionText: input.questionText.trim(), answerText: response.content, scoreMaximum: input.scoreMaximum, attachments: response.attachments, disclosure: ["将发送题面文本、所选答卷版本的文本内容、答卷形式和满分。", response.attachments.length ? "当前版本不会上传纸质附件或原始图片；附件名称和数量仅在本机展示。" : "本次答卷没有纸质附件。", "模型输出只会先保存为待审核的 AI 评分草案，不自动写入正式报告。"] };
  authorizations.set(token, { ...preview, responseId: response.id, sessionId: session.id });
  return preview;
}

function normalizeString(value: unknown, limit: number) { return typeof value === "string" ? value.trim().slice(0, limit) : ""; }
function parseJson(content: string) { const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? content; const start = fenced.indexOf("{"); const end = fenced.lastIndexOf("}"); if (start < 0 || end <= start) throw new Error("AI 返回内容不是可解析的评分 JSON。"); return JSON.parse(fenced.slice(start, end + 1)) as Record<string, unknown>; }
function normalizeAssessment(content: string, preview: AuthorizedAssessment): SaveAssessmentInput {
  const data = parseJson(content); const scoreAwarded = Number(data.score_awarded); const scoreMaximum = Number(data.score_maximum ?? preview.scoreMaximum);
  if (!Number.isFinite(scoreAwarded) || !Number.isFinite(scoreMaximum) || scoreMaximum !== preview.scoreMaximum || scoreAwarded < 0 || scoreAwarded > scoreMaximum) throw new Error("AI 评分 JSON 的总分无效。");
  const evidence: AssessmentEvidenceInput[] = Array.isArray(data.evidence) ? data.evidence.slice(0, 30).map((item, ordinal) => { const row = item as Record<string, unknown>; const maximumPoints = Number(row.maximum_points); const awardedPoints = Number(row.awarded_points); if (!Number.isFinite(maximumPoints) || !Number.isFinite(awardedPoints) || maximumPoints < 0 || awardedPoints < 0 || awardedPoints > maximumPoints) throw new Error("AI 评分依据格式无效。"); return { criterion: normalizeString(row.criterion, 500), maximumPoints, awardedPoints, rationale: normalizeString(row.rationale, 4_000), responseQuote: normalizeString(row.response_quote, 4_000), ordinal: ordinal + 1 }; }) : [];
  if (!evidence.length) throw new Error("AI 评分草案至少需要一条评分依据。");
  const evidenceMaximum = evidence.reduce((sum, item) => sum + item.maximumPoints, 0); const evidenceAwarded = evidence.reduce((sum, item) => sum + item.awardedPoints, 0);
  if (Math.abs(evidenceMaximum - scoreMaximum) > 0.001 || Math.abs(evidenceAwarded - scoreAwarded) > 0.001) throw new Error("AI 评分依据合计与总分不一致。");
  const mistakes: AssessmentMistakeInput[] = Array.isArray(data.mistakes) ? data.mistakes.slice(0, 20).map((item, ordinal) => { const row = item as Record<string, unknown>; const category = normalizeString(row.category, 30); const severity = normalizeString(row.severity, 30); if (!validCategories.has(category) || !validSeverities.has(severity)) throw new Error("AI 错因类别格式无效。"); return { category: category as AssessmentMistakeInput["category"], severity: severity as AssessmentMistakeInput["severity"], module: normalizeString(row.module, 180), note: normalizeString(row.note, 4_000), ordinal: ordinal + 1 }; }) : [];
  const modules: AssessmentModuleInput[] = Array.isArray(data.modules) ? data.modules.slice(0, 12).map((item, ordinal) => { const row = item as Record<string, unknown>; const maximumPoints = Number(row.maximum_points); const awardedPoints = Number(row.awarded_points); if (!Number.isFinite(maximumPoints) || !Number.isFinite(awardedPoints) || maximumPoints <= 0 || awardedPoints < 0 || awardedPoints > maximumPoints) throw new Error("AI 模块拆分格式无效。"); return { module: normalizeString(row.module, 180), maximumPoints, awardedPoints, note: normalizeString(row.note, 2_000), ordinal: ordinal + 1 }; }) : [];
  return { sessionId: preview.sessionId, responseId: preview.responseId, status: "draft", scoreAwarded, scoreMaximum, summary: normalizeString(data.summary, 4_000), overallFeedback: normalizeString(data.overall_feedback, 12_000), evidence, mistakes, modules };
}

function buildPrompt(preview: AuthorizedAssessment) {
  const schema = `{"score_awarded":number,"score_maximum":${preview.scoreMaximum},"summary":string,"overall_feedback":string,"evidence":[{"criterion":string,"maximum_points":number,"awarded_points":number,"rationale":string,"response_quote":string}],"mistakes":[{"category":"conceptual|method|reasoning|completeness|calculation|communication|time|other","severity":"minor|moderate|major","module":string,"note":string}],"modules":[{"module":string,"maximum_points":number,"awarded_points":number,"note":string}]}`;
  return `你是欧几里得数学竞赛的严谨阅卷助理。只依据题面和答卷评分；不要编造题面未给出的条件。以满分 ${preview.scoreMaximum} 分评分。输出严格 JSON，不要 Markdown，不要额外文字。评分依据的得分和满分合计必须分别等于总分与 ${preview.scoreMaximum}。JSON 结构：${schema}\n\n题面：\n${preview.questionText}\n\n答卷：\n${preview.answerText || "（该作答版本没有可发送的文本内容；不得依据附件猜测。）"}`;
}

export async function runAuthorizedAiAssessment(app: App, storage: SecureStringStorage, authorizationToken: string, platform?: NodeJS.Platform): Promise<AiAssessmentRunResult> {
  const preview = authorizations.get(authorizationToken);
  if (!preview) throw new Error("本次 AI 判卷授权不存在或已被使用，请重新查看发送范围并确认。");
  authorizations.delete(authorizationToken);
  if (Date.parse(preview.expiresAt) < Date.now()) throw new Error("本次 AI 判卷授权已过期，请重新查看发送范围并确认。");
  const provider = await getAiProviderForUse(app, storage, preview.providerId, platform);
  const auditId = randomUUID();
  createAiRunAudit(app, { id: auditId, providerId: provider.id, sessionId: preview.sessionId, responseId: preview.responseId, action: "assessment", status: "authorized", requestSummary: `题面 ${preview.questionText.length} 字符；答卷文本 ${preview.answerText.length} 字符；满分 ${preview.scoreMaximum}；附件 ${preview.attachments.length} 个（未上传）` });
  updateAiRunAudit(app, auditId, { status: "running" });
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch(apiUrl(provider.baseUrl, "/chat/completions"), { method: "POST", headers: { Authorization: `Bearer ${provider.apiKey}`, "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ model: provider.model, temperature: 0, messages: [{ role: "system", content: "You are a precise mathematical competition evaluator. Return valid JSON only." }, { role: "user", content: buildPrompt(preview) }], response_format: { type: "json_object" } }), signal: controller.signal });
    if (!response.ok) throw new Error(`服务返回 HTTP ${response.status}。`);
    const json = await response.json() as { choices?: Array<{ message?: { content?: unknown } }> };
    const content = typeof json.choices?.[0]?.message?.content === "string" ? json.choices[0].message.content : "";
    if (!content) throw new Error("AI 服务未返回可用的评分内容。");
    const assessment = saveAiAssessmentDraft(app, normalizeAssessment(content, preview));
    const excerpt = content.slice(0, 4_000);
    updateAiRunAudit(app, auditId, { status: "succeeded", assessmentId: assessment.id, responseExcerpt: excerpt });
    return { auditId, assessment, providerLabel: provider.providerLabel, model: provider.model, responseExcerpt: excerpt };
  } catch (error) { const message = safeFailure(error); updateAiRunAudit(app, auditId, { status: "failed", errorMessage: message }); throw new Error(message); } finally { clearTimeout(timer); }
}
