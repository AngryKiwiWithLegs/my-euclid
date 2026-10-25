import { randomUUID } from "node:crypto";
import type { App } from "electron";
import { getDatabase } from "./connection.js";
import type {
  PracticeResponse,
  PracticeSessionDetail,
  ResponseAttachmentSummary,
  SavePracticeResponseInput,
} from "../types.js";

export function savePracticeResponse(
  app: App,
  input: SavePracticeResponseInput
): PracticeSessionDetail {
  const db = getDatabase(app);
  const now = new Date().toISOString();
  const sessionId = input.sessionId ?? randomUUID();
  const transaction = db.transaction(() => {
    const existing = db
      .prepare("SELECT id FROM practice_sessions WHERE id = ?")
      .get(sessionId);
    if (!existing)
      db.prepare(
        `INSERT INTO practice_sessions (id, reference_key, title, status, started_at, updated_at) VALUES (?, ?, ?, 'active', ?, ?)`
      ).run(sessionId, input.referenceKey, input.title, now, now);
    const version =
      (
        db
          .prepare(
            "SELECT COALESCE(MAX(version), 0) AS value FROM practice_responses WHERE session_id = ?"
          )
          .get(sessionId) as { value: number }
      ).value + 1;
    db.prepare(
      `INSERT INTO practice_responses (id, session_id, answer_format, content, status, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      randomUUID(),
      sessionId,
      input.answerFormat,
      input.content,
      input.status,
      version,
      now,
      now
    );
    db.prepare(
      `UPDATE practice_sessions SET status = ?, updated_at = ?, submitted_at = CASE WHEN ? = 'submitted' THEN ? ELSE submitted_at END WHERE id = ?`
    ).run(
      input.status === "submitted" ? "submitted" : "active",
      now,
      input.status,
      now,
      sessionId
    );
  });
  transaction();
  return getPracticeSession(app, sessionId)!;
}

export function createPaperResponse(
  app: App,
  sessionId: string,
  referenceKey: string,
  title: string
) {
  const db = getDatabase(app);
  const now = new Date().toISOString();
  const resolvedSessionId = sessionId || randomUUID();
  const existing = db
    .prepare("SELECT id FROM practice_sessions WHERE id = ?")
    .get(resolvedSessionId);
  if (!existing)
    db.prepare(
      `INSERT INTO practice_sessions (id, reference_key, title, status, started_at, updated_at) VALUES (?, ?, ?, 'active', ?, ?)`
    ).run(resolvedSessionId, referenceKey, title, now, now);
  const version =
    (
      db
        .prepare(
          "SELECT COALESCE(MAX(version), 0) AS value FROM practice_responses WHERE session_id = ?"
        )
        .get(resolvedSessionId) as { value: number }
    ).value + 1;
  const responseId = randomUUID();
  db.prepare(
    `INSERT INTO practice_responses (id, session_id, answer_format, content, status, version, created_at, updated_at) VALUES (?, ?, 'paper_attachment', '', 'draft', ?, ?, ?)`
  ).run(responseId, resolvedSessionId, version, now, now);
  db.prepare("UPDATE practice_sessions SET updated_at = ? WHERE id = ?").run(
    now,
    resolvedSessionId
  );
  return { sessionId: resolvedSessionId, responseId };
}

export function addResponseAttachment(
  app: App,
  input: Omit<ResponseAttachmentSummary, "createdAt"> & {
    storedName: string;
    sha256: string;
  }
) {
  const db = getDatabase(app);
  db.prepare(
    `INSERT INTO response_attachments (id, response_id, original_name, stored_name, sha256, mime_type, size_bytes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    input.id,
    input.responseId,
    input.originalName,
    input.storedName,
    input.sha256,
    input.mimeType,
    input.sizeBytes,
    new Date().toISOString()
  );
}

export function getPracticeSession(
  app: App,
  sessionId: string
): PracticeSessionDetail | null {
  const db = getDatabase(app);
  const session = db
    .prepare(
      `SELECT id, reference_key AS referenceKey, title, status, started_at AS startedAt, updated_at AS updatedAt FROM practice_sessions WHERE id = ?`
    )
    .get(sessionId) as Omit<PracticeSessionDetail, "responses"> | undefined;
  if (!session) return null;
  const responses = db
    .prepare(
      `SELECT id, session_id AS sessionId, answer_format AS answerFormat, content, status, version, created_at AS createdAt FROM practice_responses WHERE session_id = ? ORDER BY version DESC`
    )
    .all(sessionId) as Omit<PracticeResponse, "attachments">[];
  const attachments = db
    .prepare(
      `SELECT id, response_id AS responseId, original_name AS originalName, mime_type AS mimeType, size_bytes AS sizeBytes, created_at AS createdAt FROM response_attachments WHERE response_id IN (SELECT id FROM practice_responses WHERE session_id = ?) ORDER BY created_at DESC`
    )
    .all(sessionId) as ResponseAttachmentSummary[];
  return {
    ...session,
    responses: responses.map(response => ({
      ...response,
      attachments: attachments.filter(
        attachment => attachment.responseId === response.id
      ),
    })),
  };
}

export function getDataCounts(app: App) {
  const db = getDatabase(app);
  const count = (sql: string) =>
    (db.prepare(sql).get() as { count: number }).count;
  return {
    documentCount: count("SELECT COUNT(*) AS count FROM source_documents"),
    responseCount: count("SELECT COUNT(*) AS count FROM practice_responses"),
    attachmentCount: count(
      "SELECT COUNT(*) AS count FROM response_attachments"
    ),
  };
}

export function listAssessmentSessions(app: App): PracticeSessionDetail[] {
  const db = getDatabase(app);
  const rows = db
    .prepare(
      "SELECT id FROM practice_sessions ORDER BY updated_at DESC LIMIT 30"
    )
    .all() as Array<{ id: string }>;
  return rows
    .map(row => getPracticeSession(app, row.id))
    .filter((session): session is PracticeSessionDetail => Boolean(session));
}
