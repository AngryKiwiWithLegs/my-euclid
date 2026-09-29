import Database from "better-sqlite3";
import type { App } from "electron";
import { getDatabase } from "./connection.js";
import type {
  PublishQuestionDraftInput,
  QuestionBankFilter,
  QuestionBankQuestion,
  QuestionBankStatus,
  QuestionDraft,
} from "../types.js";

function parseJsonList(value: string | null | undefined) {
  try {
    const parsed = JSON.parse(value ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter(item => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export function hydrateQuestionBank(
  db: Database.Database,
  rows: Array<Record<string, unknown>>
): QuestionBankQuestion[] {
  if (!rows.length) return [];
  const ids = rows.map(row => String(row.id));
  const placeholders = ids.map(() => "?").join(",");
  const subquestions = db
    .prepare(
      `SELECT id, question_id AS questionId, source_subquestion_draft_id AS sourceSubquestionDraftId, ordinal, label, prompt_text AS promptText, maximum_points AS maximumPoints FROM question_bank_subquestions WHERE question_id IN (${placeholders}) ORDER BY ordinal`
    )
    .all(...ids) as Array<{
    id: string;
    questionId: string;
    sourceSubquestionDraftId?: string;
    ordinal: number;
    label: string;
    promptText: string;
    maximumPoints?: number;
  }>;
  const tags = db
    .prepare(
      `SELECT id, question_id AS questionId, category, value, source FROM question_bank_tags WHERE question_id IN (${placeholders}) ORDER BY category, value`
    )
    .all(...ids) as Array<{
    id: string;
    questionId: string;
    category: string;
    value: string;
    source: "manual" | "ai_suggestion";
  }>;
  return rows.map(row => ({
    id: String(row.id),
    sourceQuestionDraftId: String(row.sourceQuestionDraftId),
    sourceDocumentId: String(row.sourceDocumentId),
    pageId: String(row.pageId),
    originalName: String(row.originalName),
    pageNumber: Number(row.pageNumber),
    label: String(row.label),
    title: String(row.title),
    promptText: String(row.promptText),
    status: row.status as QuestionBankStatus,
    sourceName: String(row.sourceName ?? ""),
    competitionYear:
      row.competitionYear === null || row.competitionYear === undefined
        ? undefined
        : Number(row.competitionYear),
    questionNumber:
      row.questionNumber === null || row.questionNumber === undefined
        ? undefined
        : Number(row.questionNumber),
    primaryTopic: String(row.primaryTopic ?? ""),
    secondaryTopics: parseJsonList(row.secondaryTopicsJson as string),
    difficulty:
      row.difficulty === null || row.difficulty === undefined
        ? undefined
        : Number(row.difficulty),
    questionType: String(row.questionType ?? ""),
    methods: parseJsonList(row.methodsJson as string),
    proofRequired: Boolean(row.proofRequired),
    estimatedMinutes:
      row.estimatedMinutes === null || row.estimatedMinutes === undefined
        ? undefined
        : Number(row.estimatedMinutes),
    maximumPoints:
      row.maximumPoints === null || row.maximumPoints === undefined
        ? undefined
        : Number(row.maximumPoints),
    scoringNotes: String(row.scoringNotes ?? ""),
    priority: Number(row.priority ?? 0),
    tags: tags
      .filter(tag => tag.questionId === row.id)
      .map(({ questionId: _questionId, ...tag }) => tag),
    subquestions: subquestions
      .filter(subquestion => subquestion.questionId === row.id)
      .map(({ questionId: _questionId, ...subquestion }) => subquestion),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  }));
}

export const questionBankSelect = `
  SELECT b.id, b.source_question_draft_id AS sourceQuestionDraftId, b.source_document_id AS sourceDocumentId, b.page_id AS pageId,
         b.status, b.source_name AS sourceName, b.competition_year AS competitionYear, b.question_number AS questionNumber,
         b.primary_topic AS primaryTopic, b.secondary_topics_json AS secondaryTopicsJson, b.difficulty, b.question_type AS questionType,
         b.methods_json AS methodsJson, b.proof_required AS proofRequired, b.estimated_minutes AS estimatedMinutes,
         b.maximum_points AS maximumPoints, b.scoring_notes AS scoringNotes, b.priority, b.created_at AS createdAt, b.updated_at AS updatedAt,
         q.label, q.title, q.prompt_text AS promptText, d.original_name AS originalName, p.page_number AS pageNumber
  FROM question_bank b
  JOIN question_drafts q ON q.id = b.source_question_draft_id
  JOIN source_documents d ON d.id = b.source_document_id
  JOIN document_pages p ON p.id = b.page_id
`;

export function publishQuestionDrafts(
  app: App,
  sourceDocumentId: string,
  inputs: PublishQuestionDraftInput[]
) {
  const db = getDatabase(app);
  const now = new Date().toISOString();
  const publish = db.transaction(() => {
    const findDraft = db.prepare(
      `SELECT id, page_id AS pageId FROM question_drafts WHERE id = ? AND source_document_id = ? AND review_status = 'confirmed'`
    );
    const findSubquestion = db.prepare(
      `SELECT id FROM subquestion_drafts WHERE id = ? AND question_draft_id = ? AND review_status = 'confirmed'`
    );
    const upsert =
      db.prepare(`INSERT INTO question_bank (id, source_question_draft_id, source_document_id, page_id, status, source_name, competition_year, question_number, primary_topic, secondary_topics_json, difficulty, question_type, methods_json, proof_required, estimated_minutes, maximum_points, scoring_notes, priority, created_at, updated_at)
      VALUES (@id, @sourceQuestionDraftId, @sourceDocumentId, @pageId, 'published', @sourceName, @competitionYear, @questionNumber, @primaryTopic, @secondaryTopicsJson, @difficulty, @questionType, @methodsJson, @proofRequired, @estimatedMinutes, @maximumPoints, @scoringNotes, @priority, @now, @now)
      ON CONFLICT(source_question_draft_id) DO UPDATE SET status = 'published', source_name = excluded.source_name, competition_year = excluded.competition_year, question_number = excluded.question_number, primary_topic = excluded.primary_topic, secondary_topics_json = excluded.secondary_topics_json, difficulty = excluded.difficulty, question_type = excluded.question_type, methods_json = excluded.methods_json, proof_required = excluded.proof_required, estimated_minutes = excluded.estimated_minutes, maximum_points = excluded.maximum_points, scoring_notes = excluded.scoring_notes, priority = excluded.priority, updated_at = excluded.updated_at`);
    const findBank = db.prepare(
      `SELECT id FROM question_bank WHERE source_question_draft_id = ?`
    );
    const clearSubs = db.prepare(
      `DELETE FROM question_bank_subquestions WHERE question_id = ?`
    );
    const clearTags = db.prepare(
      `DELETE FROM question_bank_tags WHERE question_id = ?`
    );
    const insertSub = db.prepare(
      `INSERT INTO question_bank_subquestions (id, question_id, source_subquestion_draft_id, ordinal, label, prompt_text, maximum_points) VALUES (@id, @questionId, @sourceSubquestionDraftId, @ordinal, @label, @promptText, @maximumPoints)`
    );
    const insertTag = db.prepare(
      `INSERT OR IGNORE INTO question_bank_tags (id, question_id, category, value, source) VALUES (@id, @questionId, @category, @value, @source)`
    );
    for (const input of inputs) {
      const draft = findDraft.get(input.questionDraftId, sourceDocumentId) as
        | { id: string; pageId: string }
        | undefined;
      if (!draft) throw new Error("只能发布当前资料中已确认的题目草案。");
      const meta = input.metadata;
      if (
        !meta.sourceName.trim() ||
        !meta.primaryTopic.trim() ||
        !meta.questionType.trim()
      )
        throw new Error("发布题库前必须填写来源、主考点和题型。");
      if (
        meta.difficulty !== undefined &&
        (!Number.isFinite(meta.difficulty) ||
          meta.difficulty < 1 ||
          meta.difficulty > 5)
      )
        throw new Error("难度必须为 1 到 5。");
      if (
        meta.estimatedMinutes !== undefined &&
        (!Number.isInteger(meta.estimatedMinutes) ||
          meta.estimatedMinutes < 1 ||
          meta.estimatedMinutes > 300)
      )
        throw new Error("预计用时必须为 1 到 300 分钟。");
      if (
        meta.maximumPoints !== undefined &&
        (!Number.isFinite(meta.maximumPoints) ||
          meta.maximumPoints <= 0 ||
          meta.maximumPoints > 100)
      )
        throw new Error("题目满分必须为正数且不超过 100。");
      const id =
        (findBank.get(draft.id) as { id: string } | undefined)?.id ??
        crypto.randomUUID();
      upsert.run({
        id,
        sourceQuestionDraftId: draft.id,
        sourceDocumentId,
        pageId: draft.pageId,
        sourceName: meta.sourceName.trim(),
        competitionYear: meta.competitionYear ?? null,
        questionNumber: meta.questionNumber ?? null,
        primaryTopic: meta.primaryTopic.trim(),
        secondaryTopicsJson: JSON.stringify(
          meta.secondaryTopics.map(value => value.trim()).filter(Boolean)
        ),
        difficulty: meta.difficulty ?? null,
        questionType: meta.questionType.trim(),
        methodsJson: JSON.stringify(
          meta.methods.map(value => value.trim()).filter(Boolean)
        ),
        proofRequired: meta.proofRequired ? 1 : 0,
        estimatedMinutes: meta.estimatedMinutes ?? null,
        maximumPoints: meta.maximumPoints ?? null,
        scoringNotes: meta.scoringNotes.trim(),
        priority: Math.max(0, Math.min(5, Math.round(meta.priority))),
        now,
      });
      clearSubs.run(id);
      clearTags.run(id);
      meta.subquestions.forEach((subquestion, index) => {
        if (
          subquestion.sourceSubquestionDraftId &&
          !findSubquestion.get(subquestion.sourceSubquestionDraftId, draft.id)
        )
          throw new Error("小问来源不属于当前题目草案。");
        insertSub.run({
          id: crypto.randomUUID(),
          questionId: id,
          sourceSubquestionDraftId:
            subquestion.sourceSubquestionDraftId ?? null,
          ordinal: index + 1,
          label:
            subquestion.label.trim() || `(${String.fromCharCode(97 + index)})`,
          promptText: subquestion.promptText.trim(),
          maximumPoints: subquestion.maximumPoints ?? null,
        });
      });
      meta.tags.forEach(tag => {
        if (tag.category.trim() && tag.value.trim())
          insertTag.run({
            id: crypto.randomUUID(),
            questionId: id,
            category: tag.category.trim(),
            value: tag.value.trim(),
            source: tag.source ?? "manual",
          });
      });
    }
  });
  publish();
  return listQuestionBank(app, { limit: 500 }).filter(question =>
    inputs.some(
      input => question.sourceQuestionDraftId === input.questionDraftId
    )
  );
}

export function listQuestionBank(app: App, filter: QuestionBankFilter = {}) {
  const db = getDatabase(app);
  const clauses = ["b.status = 'published'"];
  const values: Array<string | number> = [];
  if (filter.query?.trim()) {
    clauses.push(
      "(q.label LIKE ? OR q.title LIKE ? OR q.prompt_text LIKE ? OR b.primary_topic LIKE ? OR b.question_type LIKE ?)"
    );
    const query = `%${filter.query.trim()}%`;
    values.push(query, query, query, query, query);
  }
  if (filter.sourceName?.trim()) {
    clauses.push("b.source_name = ?");
    values.push(filter.sourceName.trim());
  }
  if (filter.competitionYear !== undefined) {
    clauses.push("b.competition_year = ?");
    values.push(filter.competitionYear);
  }
  if (filter.primaryTopic?.trim()) {
    clauses.push("b.primary_topic = ?");
    values.push(filter.primaryTopic.trim());
  }
  if (filter.difficulty !== undefined) {
    clauses.push("b.difficulty = ?");
    values.push(filter.difficulty);
  }
  if (filter.questionType?.trim()) {
    clauses.push("b.question_type = ?");
    values.push(filter.questionType.trim());
  }
  if (filter.proofRequired !== undefined) {
    clauses.push("b.proof_required = ?");
    values.push(filter.proofRequired ? 1 : 0);
  }
  const limit = Math.max(1, Math.min(filter.limit ?? 200, 500));
  const rows = db
    .prepare(
      `${questionBankSelect} WHERE ${clauses.join(" AND ")} ORDER BY b.priority DESC, b.competition_year DESC, b.question_number ASC, b.updated_at DESC LIMIT ?`
    )
    .all(...values, limit) as Array<Record<string, unknown>>;
  return hydrateQuestionBank(db, rows);
}

export function getQuestionBankQuestion(app: App, questionId: string) {
  const db = getDatabase(app);
  const row = db
    .prepare(`${questionBankSelect} WHERE b.id = ?`)
    .get(questionId) as Record<string, unknown> | undefined;
  return row ? hydrateQuestionBank(db, [row])[0] : null;
}
