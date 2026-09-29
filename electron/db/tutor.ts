import { randomUUID } from "node:crypto";
import type { App } from "electron";
import { getDatabase } from "./connection.js";
import type { TutorPlan, TutorSession } from "../types.js";

function parseTutorPlan(value: string): TutorPlan | undefined {
  try {
    const result = JSON.parse(value);
    return result && typeof result === "object"
      ? (result as TutorPlan)
      : undefined;
  } catch {
    return undefined;
  }
}
export function getTutorSession(
  app: App,
  sessionId: string
): TutorSession | null {
  const db = getDatabase(app);
  const row = db
    .prepare(
      `SELECT id, question_id AS questionId, provider_id AS providerId, status, question_text AS questionText, answer_text AS answerText, plan_json AS planJson, created_at AS createdAt, updated_at AS updatedAt FROM tutor_sessions WHERE id = ?`
    )
    .get(sessionId) as
    | (Omit<TutorSession, "plan" | "messages"> & { planJson: string })
    | undefined;
  if (!row) return null;
  const messages = db
    .prepare(
      `SELECT id, role, content, created_at AS createdAt FROM tutor_messages WHERE tutor_session_id = ? ORDER BY created_at`
    )
    .all(sessionId) as TutorSession["messages"];
  return { ...row, plan: parseTutorPlan(row.planJson), messages };
}
export function createTutorSession(
  app: App,
  input: {
    questionId: string;
    providerId: string;
    questionText: string;
    answerText: string;
  }
) {
  const db = getDatabase(app);
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO tutor_sessions (id, question_id, provider_id, status, question_text, answer_text, created_at, updated_at) VALUES (?, ?, ?, 'active', ?, ?, ?, ?)`
  ).run(
    id,
    input.questionId,
    input.providerId,
    input.questionText.slice(0, 50_000),
    input.answerText.slice(0, 500_000),
    now,
    now
  );
  return getTutorSession(app, id)!;
}
export function saveTutorPlan(app: App, sessionId: string, plan: TutorPlan) {
  const db = getDatabase(app);
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE tutor_sessions SET plan_json = ?, updated_at = ? WHERE id = ?`
  ).run(JSON.stringify(plan), now, sessionId);
  if (!db.prepare(`SELECT id FROM tutor_sessions WHERE id = ?`).get(sessionId))
    throw new Error("互动讲解会话不存在。");
  return getTutorSession(app, sessionId)!;
}
export function appendTutorMessage(
  app: App,
  sessionId: string,
  role: "user" | "assistant",
  content: string
) {
  const db = getDatabase(app);
  const now = new Date().toISOString();
  if (!content.trim() || content.length > 20_000)
    throw new Error("互动讲解消息无效或超过保存限制。");
  db.prepare(
    `INSERT INTO tutor_messages (id, tutor_session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)`
  ).run(crypto.randomUUID(), sessionId, role, content.trim(), now);
  db.prepare(`UPDATE tutor_sessions SET updated_at = ? WHERE id = ?`).run(
    now,
    sessionId
  );
  return getTutorSession(app, sessionId)!;
}
