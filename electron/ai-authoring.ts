/**
 * 欧几里得档案室：AI 自动审核与出题管道。
 * 使用用户配置的默认 AI 服务（OpenAI 兼容）完成 OCR 校对、题目切分与元数据建议，
 * 全部产物仍走既有草案→发布链路并保留来源回链；密钥仅在主进程临时解密，不落盘、不返回 renderer。
 */
import { randomUUID } from "node:crypto";
import type { App } from "electron";
import { getAiProviderForUse, type SecureStringStorage } from "./ai-config.js";
import { createMockExam, getQuestionBankQuestion, getReviewDocument, listQuestionBank, listReviewDocuments, publishQuestionDrafts, saveQuestionDrafts, updatePageOcr } from "./database.js";
import type { AutoReviewDocumentResult, AutoReviewSummary, MockExamComposeInput, PublishQuestionDraftInput, QuestionBankMetadataInput, QuestionDraft, VariantGenerateInput } from "./types.js";

type ResolvedProvider = { id: string; providerLabel: string; baseUrl: string; model: string; apiKey: string };

async function callAi(provider: ResolvedProvider, systemPrompt: string, userPrompt: string, timeoutMs = 150_000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${provider.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${provider.apiKey}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ model: provider.model, temperature: 0, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }], response_format: { type: "json_object" } }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`服务返回 HTTP ${response.status}。`);
    const json = await response.json() as { choices?: Array<{ message?: { content?: unknown } }> };
    const content = typeof json.choices?.[0]?.message?.content === "string" ? json.choices[0].message.content : "";
    if (!content.trim()) throw new Error("AI 服务未返回内容。");
    return content;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("AI 服务响应超时，请稍后重试或更换模型。");
    throw new Error(error instanceof Error ? `AI 服务调用失败：${error.message}` : "AI 服务调用失败。");
  } finally {
    clearTimeout(timer);
  }
}

function parseAiJson(content: string): Record<string, unknown> {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? content;
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("AI 返回内容不是可解析的 JSON。");
  return JSON.parse(fenced.slice(start, end + 1)) as Record<string, unknown>;
}

function asString(value: unknown, limit: number): string {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function asStringArray(value: unknown, maxItems: number, maxLen: number): string[] {
  return Array.isArray(value) ? value.slice(0, maxItems).map(item => asString(item, maxLen)).filter(Boolean) : [];
}

function asOptionalNumber(value: unknown, min: number, max: number): number | undefined {
  const number = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(number) && number >= min && number <= max ? number : undefined;
}

/* ---------------------------------------------------------------- */
/* AI 自动审核：OCR 校对 → 题目切分 → 确认草案 → 发布题库              */
/* ---------------------------------------------------------------- */

function buildOcrPrompt(ocrText: string) {
  return `以下是一份数学竞赛试卷某页的 OCR 识别文本。请校对其中明显的识别错误：修复数学符号、上下标、标点和明显的错字，保持原始内容、语言和题意完全不变；无法确定的字符保持原样。不要翻译，不要改写，不要添加解释。\n输出严格 JSON：{"corrected_text": string}\n\nOCR 文本：\n${ocrText.slice(0, 30_000)}`;
}

function buildSplitPrompt(pages: Array<{ page_number: number; text: string }>, originalName: string) {
  const pageBlock = pages.map(page => `【第 ${page.page_number} 页】\n${page.text.slice(0, 12_000)}`).join("\n\n");
  const schema = `{"questions":[{"page_number":number,"label":string,"title":string,"prompt_text":string,"subquestions":[{"label":string,"text":string}],"metadata":{"source_name":string,"competition_year":number|null,"question_number":number|null,"primary_topic":string,"secondary_topics":string[],"question_type":string,"methods":string[],"difficulty":number|null,"estimated_minutes":number|null,"maximum_points":number|null,"scoring_notes":string}}]}`;
  return `你是欧几里得数学竞赛（Euclid Mathematics Contest）的试卷档案专家。下面是试卷《${originalName}》各页的 OCR 文本。请把整份资料切分为独立的题目（大题）：\n- 每道题包含题号 label（如 "1"、"3"）、简短中文标题 title、完整题面 prompt_text（保留英文原题文本与数学记号，不要翻译）。\n- 大题下的小问拆分为 subquestions（label 如 "(a)"，text 为该小问文本）。没有小问时留空数组。\n- metadata 给出归档建议：source_name（来源试卷名）、competition_year、question_number、primary_topic（主考点，中文，如"数列与递推"）、secondary_topics、question_type（如"解答题"）、methods（解法关键词）、difficulty（1-5）、estimated_minutes、maximum_points（该题满分）、scoring_notes（得分点提示）。\n- 只依据文本中真实出现的题目；不要编造。输出严格 JSON，结构：${schema}\n\n各页文本：\n${pageBlock}`;
}

async function autoReviewDocument(app: App, provider: ResolvedProvider, documentId: string): Promise<AutoReviewDocumentResult> {
  const detail = getReviewDocument(app, documentId);
  if (!detail) throw new Error("待审核资料不存在。");

  let pagesReviewed = 0;
  for (const page of detail.pages) {
    const ocrText = page.ocrText.trim();
    if (!ocrText) continue;
    const corrected = asString(parseAiJson(await callAi(provider, "You are a meticulous OCR proofreader for mathematics contest papers. Return valid JSON only.", buildOcrPrompt(ocrText))).corrected_text, 40_000);
    if (corrected) {
      updatePageOcr(app, page.id, corrected);
      pagesReviewed += 1;
    }
  }

  const fresh = getReviewDocument(app, documentId);
  if (!fresh) throw new Error("待审核资料读取失败。");
  const pageTexts = fresh.pages.map(page => ({ page_number: page.pageNumber, text: page.ocrText.trim() })).filter(page => page.text);
  if (!pageTexts.length) throw new Error(`《${fresh.originalName}》没有可切分的 OCR 文本；请先在审核工作台处理 OCR 失败的页面。`);

  const split = parseAiJson(await callAi(provider, "You are an expert Euclid mathematics contest paper archivist. Return valid JSON only.", buildSplitPrompt(pageTexts, fresh.originalName)));
  const rawQuestions = Array.isArray(split.questions) ? split.questions as unknown[] : [];
  if (!rawQuestions.length) throw new Error(`AI 未为《${fresh.originalName}》返回任何题目切分。`);

  const drafts: QuestionDraft[] = [];
  const metas: QuestionBankMetadataInput[] = [];
  rawQuestions.slice(0, 40).forEach((rawQuestion, index) => {
    const question = rawQuestion as Record<string, unknown>;
    const promptText = asString(question.prompt_text, 20_000);
    if (!promptText) return;
    const pageNumber = asOptionalNumber(question.page_number, 1, 10_000) ?? 1;
    const page = fresh.pages.find(item => item.pageNumber === pageNumber) ?? fresh.pages[0];
    if (!page) return;
    const parsedSubquestions = Array.isArray(question.subquestions) ? (question.subquestions as unknown[]).slice(0, 12).map((rawSub, subIndex) => {
      const sub = rawSub as Record<string, unknown>;
      return { id: randomUUID(), label: asString(sub.label, 20) || `(${String.fromCharCode(97 + subIndex)})`, text: asString(sub.text, 8_000), ordinal: subIndex + 1 };
    }).filter(sub => sub.text) : [];
    const draft: QuestionDraft = { id: randomUUID(), pageId: page.id, label: asString(question.label, 20) || String(index + 1), title: asString(question.title, 300) || `题目 ${index + 1}`, promptText, ordinal: drafts.length + 1, subquestions: parsedSubquestions };
    const meta = (question.metadata ?? {}) as Record<string, unknown>;
    drafts.push(draft);
    metas.push({
      sourceName: asString(meta.source_name, 200) || fresh.originalName,
      competitionYear: asOptionalNumber(meta.competition_year, 1900, 2100),
      questionNumber: asOptionalNumber(meta.question_number, 1, 100),
      primaryTopic: asString(meta.primary_topic, 60) || "未分类",
      secondaryTopics: asStringArray(meta.secondary_topics, 8, 40),
      difficulty: asOptionalNumber(meta.difficulty, 1, 5),
      questionType: asString(meta.question_type, 60) || "解答题",
      methods: asStringArray(meta.methods, 8, 60),
      proofRequired: false,
      estimatedMinutes: asOptionalNumber(meta.estimated_minutes, 1, 300),
      maximumPoints: asOptionalNumber(meta.maximum_points, 0.5, 100),
      scoringNotes: asString(meta.scoring_notes, 2_000),
      priority: 2,
      tags: [{ category: "来源", value: "AI 自动审核", source: "ai_suggestion" }],
      subquestions: draft.subquestions.map(sub => ({ sourceSubquestionDraftId: sub.id, ordinal: sub.ordinal, label: sub.label, promptText: sub.text })),
    });
  });

  if (!drafts.length) throw new Error(`AI 为《${fresh.originalName}》返回的切分中没有有效题面。`);
  saveQuestionDrafts(app, documentId, drafts);
  publishQuestionDrafts(app, documentId, drafts.map((draft, index) => ({ questionDraftId: draft.id!, metadata: metas[index] })));
  return { sourceDocumentId: documentId, originalName: fresh.originalName, pagesReviewed, questionsPublished: drafts.length };
}

export async function autoReviewAllDocuments(app: App, storage: SecureStringStorage, platform?: NodeJS.Platform): Promise<AutoReviewSummary> {
  const provider = await getAiProviderForUse(app, storage, undefined, platform) as ResolvedProvider;
  const pending = listReviewDocuments(app).filter(document => document.reviewStatus === "needs_review");
  if (!pending.length) throw new Error("当前没有待审核资料；全部资料都已完成审核。");
  const documents: AutoReviewDocumentResult[] = [];
  const failures: string[] = [];
  for (const document of pending) {
    try {
      documents.push(await autoReviewDocument(app, provider, document.sourceDocumentId));
    } catch (error) {
      failures.push(`《${document.originalName}》：${error instanceof Error ? error.message : "处理失败"}`);
    }
  }
  if (!documents.length) throw new Error(`AI 自动审核未能完成任何资料。\n${failures.join("\n")}`);
  return { providerLabel: provider.providerLabel, model: provider.model, documents, failures };
}

/* ---------------------------------------------------------------- */
/* AI 变式出题：按已有题目的题型生成新题并发布                         */
/* ---------------------------------------------------------------- */

function buildVariantPrompt(original: { title: string; promptText: string; primaryTopic: string; difficulty?: number; maximumPoints?: number; subquestions: Array<{ label: string; promptText: string }> }, count: number) {
  const originalText = [`题目标题：${original.title}`, `题面：\n${original.promptText}`, original.subquestions.length ? `小问：\n${original.subquestions.map(sub => `${sub.label} ${sub.promptText}`).join("\n")}` : ""].filter(Boolean).join("\n\n");
  const schema = `{"questions":[{"title":string,"prompt_text":string,"subquestions":[{"label":string,"text":string}],"metadata":{"primary_topic":string,"question_type":string,"methods":string[],"difficulty":number,"estimated_minutes":number,"maximum_points":number,"scoring_notes":string}}]}`;
  return `你是欧几里得数学竞赛的命题专家。下面是一道已归档的原题。请仿照它的题型、考点与难度，编写 ${count} 道全新的变式题：\n- 变式题必须考查同类数学方法，但情境、数据或推理路径要有实质变化，不能只是改数字。\n- 题面用英文书写（与 Euclid 真题一致），保留严格的数学表述；title 用简短中文概括。\n- 小问结构与原题类似；difficulty 参考原题（${original.difficulty ?? 3}/5），maximum_points 参考原题（${original.maximumPoints ?? 10} 分）。\n- 输出严格 JSON，结构：${schema}\n\n原题：\n${originalText.slice(0, 20_000)}`;
}

export async function generateVariantQuestions(app: App, storage: SecureStringStorage, input: VariantGenerateInput, platform?: NodeJS.Platform) {
  const count = Math.max(1, Math.min(5, Math.round(input.count ?? 1)));
  const original = getQuestionBankQuestion(app, input.questionId);
  if (!original) throw new Error("要生成变式的题目不存在。");
  const provider = await getAiProviderForUse(app, storage, undefined, platform) as ResolvedProvider;
  const data = parseAiJson(await callAi(provider, "You are an expert Euclid mathematics contest item writer. Return valid JSON only.", buildVariantPrompt({ title: original.title || original.label, promptText: original.promptText, primaryTopic: original.primaryTopic, difficulty: original.difficulty ?? undefined, maximumPoints: original.maximumPoints ?? undefined, subquestions: original.subquestions }, count)));
  const rawQuestions = Array.isArray(data.questions) ? data.questions as unknown[] : [];
  if (!rawQuestions.length) throw new Error("AI 未返回可用的变式题。");

  const drafts: QuestionDraft[] = [];
  const metas: QuestionBankMetadataInput[] = [];
  rawQuestions.slice(0, count).forEach((rawQuestion, index) => {
    const question = rawQuestion as Record<string, unknown>;
    const promptText = asString(question.prompt_text, 20_000);
    if (!promptText) return;
    const parsedSubquestions = Array.isArray(question.subquestions) ? (question.subquestions as unknown[]).slice(0, 12).map((rawSub, subIndex) => {
      const sub = rawSub as Record<string, unknown>;
      return { id: randomUUID(), label: asString(sub.label, 20) || `(${String.fromCharCode(97 + subIndex)})`, text: asString(sub.text, 8_000), ordinal: subIndex + 1 };
    }).filter(sub => sub.text) : [];
    const draft: QuestionDraft = { id: randomUUID(), pageId: original.pageId, label: `${original.label}-v${index + 1}`, title: asString(question.title, 300) || `${original.title || original.label} · 变式 ${index + 1}`, promptText, ordinal: index + 1, subquestions: parsedSubquestions };
    const meta = (question.metadata ?? {}) as Record<string, unknown>;
    drafts.push(draft);
    metas.push({
      sourceName: original.sourceName,
      competitionYear: undefined,
      questionNumber: undefined,
      primaryTopic: asString(meta.primary_topic, 60) || original.primaryTopic || "未分类",
      secondaryTopics: asStringArray(meta.secondary_topics, 8, 40),
      difficulty: asOptionalNumber(meta.difficulty, 1, 5) ?? original.difficulty ?? undefined,
      questionType: asString(meta.question_type, 60) || original.questionType || "解答题",
      methods: asStringArray(meta.methods, 8, 60),
      proofRequired: false,
      estimatedMinutes: asOptionalNumber(meta.estimated_minutes, 1, 300),
      maximumPoints: asOptionalNumber(meta.maximum_points, 0.5, 100) ?? original.maximumPoints ?? undefined,
      scoringNotes: asString(meta.scoring_notes, 2_000),
      priority: 2,
      tags: [{ category: "来源", value: "AI 变式", source: "ai_suggestion" }, { category: "原型", value: `${original.sourceName} · ${original.label}`, source: "ai_suggestion" }],
      subquestions: draft.subquestions.map(sub => ({ sourceSubquestionDraftId: sub.id, ordinal: sub.ordinal, label: sub.label, promptText: sub.text })),
    });
  });

  if (!drafts.length) throw new Error("AI 返回的变式题缺少有效题面。");
  saveQuestionDrafts(app, original.sourceDocumentId, drafts);
  return publishQuestionDrafts(app, original.sourceDocumentId, drafts.map((draft, index) => ({ questionDraftId: draft.id!, metadata: metas[index] })));
}

/* ---------------------------------------------------------------- */
/* AI 组卷：从题库挑选一套平衡的 10 题模考卷                          */
/* ---------------------------------------------------------------- */

function buildComposePrompt(catalog: Array<Record<string, unknown>>) {
  const schema = `{"question_ids":[string],"rationale":string}`;
  return `你是欧几里得数学竞赛（Euclid Contest）的组卷官。真实 Euclid 卷为 10 道大题、满分 100、题目难度从易到难、覆盖代数、几何、数列、计数概率、解析几何与证明等多个模块。请从下面的题库清单中挑选恰好 10 道题组成一套模拟卷：\n- 覆盖尽可能多的不同 primary_topic，避免同 topic 超过 2 题。\n- 难度整体从易到难排列，难度和分值分布尽量接近真实卷。\n- 只能使用清单中出现的 id，不得编造。输出严格 JSON：${schema}\n\n题库清单（JSON 行）：\n${catalog.map(item => JSON.stringify(item)).join("\n")}`;
}

function fallbackSelection(bank: ReturnType<typeof listQuestionBank>): string[] {
  const byTopic = new Map<string, ReturnType<typeof listQuestionBank>>();
  for (const question of bank) {
    const key = question.primaryTopic || "未分类";
    const list = byTopic.get(key) ?? [];
    list.push(question);
    byTopic.set(key, list);
  }
  const buckets = Array.from(byTopic.values()).map(list => list.sort((a, b) => (a.difficulty ?? 3) - (b.difficulty ?? 3)));
  const picked: string[] = [];
  let round = 0;
  while (picked.length < 10) {
    let advanced = false;
    for (const bucket of buckets) {
      if (bucket[round]) {
        picked.push(bucket[round].id);
        advanced = true;
        if (picked.length === 10) break;
      }
    }
    if (!advanced) break;
    round += 1;
  }
  return picked.slice(0, 10);
}

export async function composeMockExamWithAi(app: App, storage: SecureStringStorage, input: MockExamComposeInput, platform?: NodeJS.Platform) {
  const bank = listQuestionBank(app, { limit: 500 }).filter(question => question.status === "published");
  if (bank.length < 10) throw new Error(`正式题库只有 ${bank.length} 道已发布题目；AI 组卷需要至少 10 道。可先在审核工作台运行“AI 自动审核”，或对现有题目生成变式。`);
  const provider = await getAiProviderForUse(app, storage, undefined, platform) as ResolvedProvider;

  let pickedIds: string[] = [];
  let rationale = "";
  try {
    const catalog = bank.map(question => ({ id: question.id, source: question.sourceName, label: question.label, topic: question.primaryTopic, difficulty: question.difficulty, points: question.maximumPoints, type: question.questionType }));
    const data = parseAiJson(await callAi(provider, "You are the paper composition officer of the Euclid mathematics contest. Return valid JSON only.", buildComposePrompt(catalog), 120_000));
    const ids = Array.isArray(data.question_ids) ? data.question_ids.map(id => asString(id, 64)).filter(Boolean) : [];
    const unique = Array.from(new Set(ids)).filter(id => bank.some(question => question.id === id));
    if (unique.length >= 10) {
      pickedIds = unique.slice(0, 10);
      rationale = asString(data.rationale, 400);
    }
  } catch {
    /* AI 挑选失败时回退到本地均衡挑选 */
  }
  if (pickedIds.length !== 10) pickedIds = fallbackSelection(bank);
  if (pickedIds.length !== 10) throw new Error("题库题目不足以组成 10 题模考卷。");

  const title = input.title?.trim() || `AI 组卷 · Euclid 全真模拟 · ${new Date().toLocaleDateString("zh-CN")}`;
  const exam = createMockExam(app, { title, questionIds: pickedIds, durationSeconds: 150 * 60 });
  return { exam, rationale, providerLabel: provider.providerLabel, model: provider.model };
}