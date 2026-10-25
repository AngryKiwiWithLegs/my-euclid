import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { App } from "electron";
import { getDatabase } from "./connection.js";
import { hydrateQuestionBank, questionBankSelect } from "./questionBank.js";
import type {
  CreateMockExamInput,
  MockExamDetail,
  MockExamItem,
  MockExamStatus,
} from "../types.js";

function hydrateMockExams(
  db: Database.Database,
  rows: Array<Record<string, unknown>>
): MockExamDetail[] {
  if (!rows.length) return [];
  const ids = rows.map(row => String(row.id));
  const placeholders = ids.map(() => "?").join(",");
  const items = db
    .prepare(
      `SELECT i.id, i.exam_id AS examId, i.ordinal, i.question_id AS questionId, i.maximum_points AS maximumPoints, i.title_snapshot AS title, i.label_snapshot AS label, i.prompt_snapshot AS promptText, i.primary_topic_snapshot AS primaryTopic, i.difficulty_snapshot AS difficulty, i.practice_session_id AS sessionId,
    COUNT(r.id) AS responseCount, SUM(CASE WHEN r.status = 'submitted' THEN 1 ELSE 0 END) AS submittedResponseCount
    FROM mock_exam_items i LEFT JOIN practice_responses r ON r.session_id = i.practice_session_id
    WHERE i.exam_id IN (${placeholders}) GROUP BY i.id ORDER BY i.ordinal`
    )
    .all(...ids) as Array<MockExamItem & { examId: string }>;
  return rows.map(row => ({
    id: String(row.id),
    title: String(row.title),
    status: row.status as MockExamStatus,
    durationSeconds: Number(row.durationSeconds),
    questionCount: Number(row.questionCount),
    startedAt: row.startedAt ? String(row.startedAt) : undefined,
    submittedAt: row.submittedAt ? String(row.submittedAt) : undefined,
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
    items: items
      .filter(item => item.examId === row.id)
      .map(({ examId: _examId, ...item }) => ({
        ...item,
        responseCount: Number(item.responseCount ?? 0),
        submittedResponseCount: Number(item.submittedResponseCount ?? 0),
      })),
  }));
}

const mockExamSelect = `SELECT e.id, e.title, e.status, e.duration_seconds AS durationSeconds, e.started_at AS startedAt, e.submitted_at AS submittedAt, e.created_at AS createdAt, e.updated_at AS updatedAt, COUNT(i.id) AS questionCount FROM mock_exams e LEFT JOIN mock_exam_items i ON i.exam_id = e.id`;

export function listMockExams(app: App) {
  const db = getDatabase(app);
  const rows = db
    .prepare(
      `${mockExamSelect} GROUP BY e.id ORDER BY e.updated_at DESC LIMIT 50`
    )
    .all() as Array<Record<string, unknown>>;
  return hydrateMockExams(db, rows);
}

export function getMockExam(app: App, examId: string) {
  const db = getDatabase(app);
  const row = db
    .prepare(`${mockExamSelect} WHERE e.id = ? GROUP BY e.id`)
    .get(examId) as Record<string, unknown> | undefined;
  return row ? hydrateMockExams(db, [row])[0] : null;
}

export function createMockExam(app: App, input: CreateMockExamInput) {
  const db = getDatabase(app);
  const title = input.title.trim();
  if (!title || title.length > 160) throw new Error("模考试卷标题无效。");
  if (
    !Array.isArray(input.questionIds) ||
    input.questionIds.length !== 10 ||
    new Set(input.questionIds).size !== 10
  )
    throw new Error("全真欧几里得模考必须选择 10 道不同的已发布题目。");
  const rows = input.questionIds.map(
    questionId =>
      db
        .prepare(
          `${questionBankSelect} WHERE b.id = ? AND b.status = 'published'`
        )
        .get(questionId) as Record<string, unknown> | undefined
  );
  if (rows.some(row => !row))
    throw new Error("模考题目中存在未发布或不存在的题目。");
  const questions = hydrateQuestionBank(
    db,
    rows as Array<Record<string, unknown>>
  );
  const now = new Date().toISOString();
  const examId = randomUUID();
  const durationSeconds = input.durationSeconds ?? 150 * 60;
  if (
    !Number.isInteger(durationSeconds) ||
    durationSeconds < 60 ||
    durationSeconds > 21600
  )
    throw new Error("模考时长无效。");
  const create = db.transaction(() => {
    db.prepare(
      `INSERT INTO mock_exams (id, title, status, duration_seconds, created_at, updated_at) VALUES (?, ?, 'draft', ?, ?, ?)`
    ).run(examId, title, durationSeconds, now, now);
    const insertSession = db.prepare(
      `INSERT INTO practice_sessions (id, reference_key, title, status, started_at, updated_at) VALUES (@id, @referenceKey, @title, 'active', @now, @now)`
    );
    const insertItem = db.prepare(
      `INSERT INTO mock_exam_items (id, exam_id, question_id, practice_session_id, ordinal, maximum_points, title_snapshot, label_snapshot, prompt_snapshot, primary_topic_snapshot, difficulty_snapshot) VALUES (@id, @examId, @questionId, @sessionId, @ordinal, @maximumPoints, @title, @label, @promptText, @primaryTopic, @difficulty)`
    );
    questions.forEach((question, index) => {
      const sessionId = randomUUID();
      insertSession.run({
        id: sessionId,
        referenceKey: `mock:${examId}:q:${index + 1}`,
        title: `${title} · 第 ${index + 1} 题`,
        now,
      });
      insertItem.run({
        id: randomUUID(),
        examId,
        questionId: question.id,
        sessionId,
        ordinal: index + 1,
        maximumPoints: question.maximumPoints ?? null,
        title: question.title,
        label: question.label,
        promptText: question.promptText,
        primaryTopic: question.primaryTopic,
        difficulty: question.difficulty ?? null,
      });
    });
  });
  create();
  return getMockExam(app, examId)!;
}

export function startMockExam(app: App, examId: string) {
  const db = getDatabase(app);
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `UPDATE mock_exams SET status = 'active', started_at = COALESCE(started_at, ?), updated_at = ? WHERE id = ? AND status IN ('draft', 'active')`
    )
    .run(now, now, examId);
  if (result.changes !== 1)
    throw new Error("该模考无法开始，可能已经交卷或不存在。");
  return getMockExam(app, examId)!;
}

export function submitMockExam(app: App, examId: string) {
  const db = getDatabase(app);
  const now = new Date().toISOString();
  const submit = db.transaction(() => {
    const exam = db
      .prepare(`SELECT status FROM mock_exams WHERE id = ?`)
      .get(examId) as { status: MockExamStatus } | undefined;
    if (!exam || !["draft", "active"].includes(exam.status))
      throw new Error("该模考无法交卷，可能已经交卷或不存在。");
    db.prepare(
      `UPDATE mock_exams SET status = 'submitted', started_at = COALESCE(started_at, ?), submitted_at = ?, updated_at = ? WHERE id = ?`
    ).run(now, now, now, examId);
    db.prepare(
      `UPDATE practice_sessions SET status = 'submitted', submitted_at = COALESCE(submitted_at, ?), updated_at = ? WHERE id IN (SELECT practice_session_id FROM mock_exam_items WHERE exam_id = ?)`
    ).run(now, now, examId);
  });
  submit();
  return getMockExam(app, examId)!;
}
