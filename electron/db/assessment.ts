import { randomUUID } from "node:crypto";
import type { App } from "electron";
import { getDatabase } from "./connection.js";
import type {
  AssessmentDashboard,
  AssessmentRecordDetail,
  AssessmentRecordSummary,
  SaveAssessmentInput,
} from "../types.js";

const assessmentSummarySql = `SELECT a.id, a.session_id AS sessionId, a.response_id AS responseId, s.reference_key AS referenceKey, s.title,
  r.version AS responseVersion, r.answer_format AS answerFormat, a.origin, a.status, a.version, a.score_awarded AS scoreAwarded,
  a.score_maximum AS scoreMaximum, a.overall_feedback AS overallFeedback, a.summary, a.created_at AS createdAt, a.confirmed_at AS confirmedAt
  FROM assessment_records a JOIN practice_sessions s ON s.id = a.session_id JOIN practice_responses r ON r.id = a.response_id`;

export function listAssessmentRecords(app: App): AssessmentRecordSummary[] {
  return getDatabase(app)
    .prepare(`${assessmentSummarySql} ORDER BY a.created_at DESC LIMIT 40`)
    .all() as AssessmentRecordSummary[];
}

export function getAssessmentRecord(
  app: App,
  assessmentId: string
): AssessmentRecordDetail | null {
  const db = getDatabase(app);
  const summary = db
    .prepare(`${assessmentSummarySql} WHERE a.id = ?`)
    .get(assessmentId) as AssessmentRecordSummary | undefined;
  if (!summary) return null;
  const evidence = db
    .prepare(
      `SELECT id, criterion, maximum_points AS maximumPoints, awarded_points AS awardedPoints, rationale, response_quote AS responseQuote, ordinal FROM assessment_evidence WHERE assessment_id = ? ORDER BY ordinal`
    )
    .all(assessmentId) as AssessmentRecordDetail["evidence"];
  const mistakes = db
    .prepare(
      `SELECT id, category, module, severity, note, ordinal FROM assessment_mistakes WHERE assessment_id = ? ORDER BY ordinal`
    )
    .all(assessmentId) as AssessmentRecordDetail["mistakes"];
  const modules = db
    .prepare(
      `SELECT id, module, awarded_points AS awardedPoints, maximum_points AS maximumPoints, note, ordinal FROM assessment_modules WHERE assessment_id = ? ORDER BY ordinal`
    )
    .all(assessmentId) as AssessmentRecordDetail["modules"];
  return {
    ...summary,
    confirmedAt: summary.confirmedAt ?? undefined,
    evidence,
    mistakes,
    modules,
  };
}

function saveAssessmentRecordWithOrigin(
  app: App,
  input: SaveAssessmentInput,
  origin: "manual" | "ai"
): AssessmentRecordDetail {
  const db = getDatabase(app);
  const now = new Date().toISOString();
  const response = db
    .prepare(
      "SELECT id FROM practice_responses WHERE id = ? AND session_id = ?"
    )
    .get(input.responseId, input.sessionId);
  if (!response) throw new Error("所选答卷版本不属于当前训练会话。");
  const assessmentId = randomUUID();
  const transaction = db.transaction(() => {
    const version =
      (
        db
          .prepare(
            "SELECT COALESCE(MAX(version), 0) AS value FROM assessment_records WHERE session_id = ?"
          )
          .get(input.sessionId) as { value: number }
      ).value + 1;
    db.prepare(
      `INSERT INTO assessment_records (id, session_id, response_id, origin, status, version, score_awarded, score_maximum, overall_feedback, summary, created_at, confirmed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      assessmentId,
      input.sessionId,
      input.responseId,
      origin,
      input.status,
      version,
      input.scoreAwarded,
      input.scoreMaximum,
      input.overallFeedback.slice(0, 12_000),
      input.summary.slice(0, 4_000),
      now,
      input.status === "confirmed" ? now : null
    );
    const evidence = db.prepare(
      `INSERT INTO assessment_evidence (id, assessment_id, criterion, maximum_points, awarded_points, rationale, response_quote, ordinal) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const mistakes = db.prepare(
      `INSERT INTO assessment_mistakes (id, assessment_id, category, module, severity, note, ordinal) VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const modules = db.prepare(
      `INSERT INTO assessment_modules (id, assessment_id, module, awarded_points, maximum_points, note, ordinal) VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    for (const item of input.evidence)
      evidence.run(
        randomUUID(),
        assessmentId,
        item.criterion.slice(0, 500),
        item.maximumPoints,
        item.awardedPoints,
        item.rationale.slice(0, 4_000),
        item.responseQuote.slice(0, 4_000),
        item.ordinal
      );
    for (const item of input.mistakes)
      mistakes.run(
        randomUUID(),
        assessmentId,
        item.category,
        item.module.slice(0, 180),
        item.severity,
        item.note.slice(0, 4_000),
        item.ordinal
      );
    for (const item of input.modules)
      modules.run(
        randomUUID(),
        assessmentId,
        item.module.slice(0, 180),
        item.awardedPoints,
        item.maximumPoints,
        item.note.slice(0, 2_000),
        item.ordinal
      );
  });
  transaction();
  return getAssessmentRecord(app, assessmentId)!;
}

export function saveAssessmentRecord(
  app: App,
  input: SaveAssessmentInput
): AssessmentRecordDetail {
  return saveAssessmentRecordWithOrigin(app, input, "manual");
}
export function saveAiAssessmentDraft(
  app: App,
  input: SaveAssessmentInput
): AssessmentRecordDetail {
  return saveAssessmentRecordWithOrigin(
    app,
    { ...input, status: "draft" },
    "ai"
  );
}

export function createAiRunAudit(
  app: App,
  input: {
    id: string;
    providerId: string;
    sessionId: string;
    responseId: string;
    action: "connection_test" | "model_discovery" | "assessment";
    status: "authorized" | "running" | "succeeded" | "failed" | "expired";
    requestSummary: string;
  }
) {
  getDatabase(app)
    .prepare(
      `INSERT INTO ai_run_audits (id, provider_id, session_id, response_id, action, status, authorized_at, request_summary) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.id,
      input.providerId,
      input.sessionId,
      input.responseId,
      input.action,
      input.status,
      new Date().toISOString(),
      input.requestSummary.slice(0, 12_000)
    );
}

export function updateAiRunAudit(
  app: App,
  auditId: string,
  input: {
    status: "running" | "succeeded" | "failed" | "expired";
    assessmentId?: string;
    responseExcerpt?: string;
    errorMessage?: string;
  }
) {
  const now = new Date().toISOString();
  getDatabase(app)
    .prepare(
      `UPDATE ai_run_audits SET status = ?, started_at = CASE WHEN ? = 'running' THEN ? ELSE started_at END, completed_at = CASE WHEN ? IN ('succeeded', 'failed', 'expired') THEN ? ELSE completed_at END, assessment_id = COALESCE(?, assessment_id), response_excerpt = CASE WHEN ? IS NULL THEN response_excerpt ELSE ? END, error_message = CASE WHEN ? IS NULL THEN error_message ELSE ? END WHERE id = ?`
    )
    .run(
      input.status,
      input.status,
      now,
      input.status,
      now,
      input.assessmentId ?? null,
      input.responseExcerpt ?? null,
      (input.responseExcerpt ?? "").slice(0, 12_000),
      input.errorMessage ?? null,
      (input.errorMessage ?? "").slice(0, 2_000),
      auditId
    );
}

export function getAssessmentDashboard(app: App): AssessmentDashboard {
  const db = getDatabase(app);
  const totals = db
    .prepare(
      `SELECT COUNT(*) AS assessmentCount, SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) AS confirmedCount,
    SUM(CASE WHEN status = 'confirmed' THEN score_awarded ELSE 0 END) AS awarded, SUM(CASE WHEN status = 'confirmed' THEN score_maximum ELSE 0 END) AS maximum
    FROM assessment_records`
    )
    .get() as {
    assessmentCount: number;
    confirmedCount: number;
    awarded: number | null;
    maximum: number | null;
  };
  const latest = db
    .prepare(
      "SELECT score_awarded / score_maximum AS scoreRate FROM assessment_records WHERE status = 'confirmed' ORDER BY created_at DESC LIMIT 1"
    )
    .get() as { scoreRate: number } | undefined;
  const history = db
    .prepare(
      `SELECT id AS assessmentId, created_at AS createdAt, score_awarded / score_maximum AS scoreRate FROM assessment_records WHERE status = 'confirmed' ORDER BY created_at ASC LIMIT 30`
    )
    .all() as AssessmentDashboard["history"];
  const modules = db
    .prepare(
      `SELECT m.module, SUM(m.awarded_points) AS awardedPoints, SUM(m.maximum_points) AS maximumPoints, SUM(m.awarded_points) / SUM(m.maximum_points) AS scoreRate
    FROM assessment_modules m JOIN assessment_records a ON a.id = m.assessment_id WHERE a.status = 'confirmed' GROUP BY m.module ORDER BY maximumPoints DESC`
    )
    .all() as AssessmentDashboard["modules"];
  const mistakes = db
    .prepare(
      `SELECT m.category, COUNT(*) AS count FROM assessment_mistakes m JOIN assessment_records a ON a.id = m.assessment_id WHERE a.status = 'confirmed' GROUP BY m.category ORDER BY count DESC`
    )
    .all() as AssessmentDashboard["mistakes"];
  return {
    assessmentCount: totals.assessmentCount,
    confirmedCount: totals.confirmedCount ?? 0,
    weightedScoreRate: totals.maximum ? totals.awarded! / totals.maximum : null,
    latestScoreRate: latest?.scoreRate ?? null,
    recentAssessments: listAssessmentRecords(app),
    history,
    modules,
    mistakes,
    aiStatus: "not_configured",
  };
}

export function writeBackupAudit(
  app: App,
  action: "export" | "preflight" | "restore",
  backupId: string | null,
  status: "success" | "failed",
  summary: unknown
) {
  getDatabase(app)
    .prepare(
      `INSERT INTO backup_audits (id, action, backup_id, status, summary_json, created_at) VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      randomUUID(),
      action,
      backupId,
      status,
      JSON.stringify(summary),
      new Date().toISOString()
    );
}
