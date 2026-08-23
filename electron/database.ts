import Database from "better-sqlite3";
import path from "node:path";
import type { App } from "electron";
import type { ArchiveHealth, AssessmentDashboard, AssessmentRecordDetail, AssessmentRecordSummary, ImportJobSummary, InkLayer, InkResponseDetail, InkSaveResult, InkStroke, NormalizedRect, OcrRegion, PracticeResponse, PracticeSessionDetail, QuestionDraft, ResponseAttachmentSummary, ReviewDocumentDetail, ReviewDocumentSummary, ReviewPage, SaveAssessmentInput, SaveInkResponseInput, SavePracticeResponseInput } from "./types.js";

let database: Database.Database | null = null;

export function getDatabase(app: App) {
  if (database) return database;
  const databasePath = path.join(app.getPath("userData"), "my-euclid.sqlite");
  database = new Database(databasePath);
  database.pragma("foreign_keys = ON");
  migrate(database);
  return database;
}

export function getDatabasePath(app: App) { return path.join(app.getPath("userData"), "my-euclid.sqlite"); }

export function closeDatabase() { database?.close(); database = null; }

export function checkpointDatabase(app: App) { getDatabase(app).pragma("wal_checkpoint(TRUNCATE)"); }

function migrate(db: Database.Database) {
  const currentVersion = Number(db.pragma("user_version", { simple: true }));
  if (currentVersion < 1) {
    db.exec(`
    CREATE TABLE IF NOT EXISTS source_documents (
      id TEXT PRIMARY KEY,
      original_name TEXT NOT NULL,
      source_kind TEXT NOT NULL CHECK (source_kind IN ('source_document', 'paper_response')),
      stored_name TEXT NOT NULL,
      sha256 TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      imported_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS document_pages (
      id TEXT PRIMARY KEY,
      source_document_id TEXT NOT NULL REFERENCES source_documents(id) ON DELETE CASCADE,
      page_number INTEGER NOT NULL,
      image_path TEXT,
      ocr_text TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS import_jobs (
      id TEXT PRIMARY KEY,
      source_document_id TEXT NOT NULL REFERENCES source_documents(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK (status IN ('queued', 'archived', 'needs_review', 'failed')),
      error_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON import_jobs(status);
    CREATE INDEX IF NOT EXISTS idx_document_pages_source ON document_pages(source_document_id);
  `);
    db.pragma("user_version = 1");
  }
  if (currentVersion < 2) {
    db.exec(`
      ALTER TABLE document_pages ADD COLUMN ocr_status TEXT NOT NULL DEFAULT 'pending' CHECK (ocr_status IN ('pending', 'extracted', 'failed', 'reviewed'));
      ALTER TABLE document_pages ADD COLUMN review_status TEXT NOT NULL DEFAULT 'needs_review' CHECK (review_status IN ('needs_review', 'confirmed'));
      ALTER TABLE document_pages ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
      CREATE TABLE IF NOT EXISTS question_drafts (
        id TEXT PRIMARY KEY,
        source_document_id TEXT NOT NULL REFERENCES source_documents(id) ON DELETE CASCADE,
        page_id TEXT NOT NULL REFERENCES document_pages(id) ON DELETE CASCADE,
        ordinal INTEGER NOT NULL,
        label TEXT NOT NULL,
        title TEXT NOT NULL,
        prompt_text TEXT NOT NULL,
        review_status TEXT NOT NULL DEFAULT 'needs_review' CHECK (review_status IN ('needs_review', 'confirmed')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS subquestion_drafts (
        id TEXT PRIMARY KEY,
        question_draft_id TEXT NOT NULL REFERENCES question_drafts(id) ON DELETE CASCADE,
        ordinal INTEGER NOT NULL,
        label TEXT NOT NULL,
        prompt_text TEXT NOT NULL,
        review_status TEXT NOT NULL DEFAULT 'needs_review' CHECK (review_status IN ('needs_review', 'confirmed')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_question_drafts_source ON question_drafts(source_document_id);
      CREATE INDEX IF NOT EXISTS idx_subquestion_drafts_question ON subquestion_drafts(question_draft_id);
    `);
    db.pragma("user_version = 2");
  }
  if (currentVersion < 3) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS practice_sessions (
        id TEXT PRIMARY KEY,
        reference_key TEXT NOT NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('active', 'submitted', 'archived')),
        started_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        submitted_at TEXT
      );
      CREATE TABLE IF NOT EXISTS practice_responses (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
        answer_format TEXT NOT NULL CHECK (answer_format IN ('keyboard', 'handwritten', 'paper_attachment')),
        content TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL CHECK (status IN ('draft', 'submitted')),
        version INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS response_attachments (
        id TEXT PRIMARY KEY,
        response_id TEXT NOT NULL REFERENCES practice_responses(id) ON DELETE CASCADE,
        original_name TEXT NOT NULL,
        stored_name TEXT NOT NULL,
        sha256 TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS backup_audits (
        id TEXT PRIMARY KEY,
        action TEXT NOT NULL CHECK (action IN ('export', 'preflight', 'restore')),
        backup_id TEXT,
        status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
        summary_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_practice_sessions_updated ON practice_sessions(updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_practice_responses_session ON practice_responses(session_id, version);
      CREATE INDEX IF NOT EXISTS idx_response_attachments_response ON response_attachments(response_id);
    `);
    db.pragma("user_version = 3");
  }
  if (currentVersion < 4) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS ink_layers (
        id TEXT PRIMARY KEY,
        response_id TEXT NOT NULL REFERENCES practice_responses(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        ordinal INTEGER NOT NULL,
        is_visible INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ink_strokes (
        id TEXT PRIMARY KEY,
        layer_id TEXT NOT NULL REFERENCES ink_layers(id) ON DELETE CASCADE,
        ordinal INTEGER NOT NULL,
        tool TEXT NOT NULL CHECK (tool IN ('pen', 'eraser')),
        color TEXT NOT NULL,
        width REAL NOT NULL,
        points_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ink_snapshots (
        id TEXT PRIMARY KEY,
        response_id TEXT NOT NULL UNIQUE REFERENCES practice_responses(id) ON DELETE CASCADE,
        canvas_width INTEGER NOT NULL,
        canvas_height INTEGER NOT NULL,
        preview_svg TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_ink_layers_response ON ink_layers(response_id, ordinal);
      CREATE INDEX IF NOT EXISTS idx_ink_strokes_layer ON ink_strokes(layer_id, ordinal);
    `);
    db.pragma("user_version = 4");
  }
  if (currentVersion < 5) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS ocr_region_runs (
        id TEXT PRIMARY KEY,
        page_id TEXT NOT NULL REFERENCES document_pages(id) ON DELETE CASCADE,
        x REAL NOT NULL CHECK (x >= 0 AND x <= 1),
        y REAL NOT NULL CHECK (y >= 0 AND y <= 1),
        width REAL NOT NULL CHECK (width > 0 AND width <= 1),
        height REAL NOT NULL CHECK (height > 0 AND height <= 1),
        source_width INTEGER NOT NULL,
        source_height INTEGER NOT NULL,
        crop_sha256 TEXT NOT NULL,
        crop_preview_data_url TEXT NOT NULL,
        ocr_text TEXT NOT NULL,
        ocr_status TEXT NOT NULL CHECK (ocr_status IN ('pending', 'extracted', 'failed', 'reviewed')),
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_ocr_region_runs_page ON ocr_region_runs(page_id, created_at DESC);
    `);
    db.pragma("user_version = 5");
  }
  if (currentVersion < 6) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS assessment_records (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
        response_id TEXT NOT NULL REFERENCES practice_responses(id) ON DELETE CASCADE,
        origin TEXT NOT NULL CHECK (origin IN ('manual', 'ai')),
        status TEXT NOT NULL CHECK (status IN ('draft', 'confirmed')),
        version INTEGER NOT NULL,
        score_awarded REAL NOT NULL CHECK (score_awarded >= 0),
        score_maximum REAL NOT NULL CHECK (score_maximum > 0),
        overall_feedback TEXT NOT NULL DEFAULT '',
        summary TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        confirmed_at TEXT
      );
      CREATE TABLE IF NOT EXISTS assessment_evidence (
        id TEXT PRIMARY KEY,
        assessment_id TEXT NOT NULL REFERENCES assessment_records(id) ON DELETE CASCADE,
        criterion TEXT NOT NULL,
        maximum_points REAL NOT NULL CHECK (maximum_points >= 0),
        awarded_points REAL NOT NULL CHECK (awarded_points >= 0),
        rationale TEXT NOT NULL DEFAULT '',
        response_quote TEXT NOT NULL DEFAULT '',
        ordinal INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS assessment_mistakes (
        id TEXT PRIMARY KEY,
        assessment_id TEXT NOT NULL REFERENCES assessment_records(id) ON DELETE CASCADE,
        category TEXT NOT NULL CHECK (category IN ('conceptual', 'method', 'reasoning', 'completeness', 'calculation', 'communication', 'time', 'other')),
        module TEXT NOT NULL DEFAULT '',
        severity TEXT NOT NULL CHECK (severity IN ('minor', 'moderate', 'major')),
        note TEXT NOT NULL DEFAULT '',
        ordinal INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS assessment_modules (
        id TEXT PRIMARY KEY,
        assessment_id TEXT NOT NULL REFERENCES assessment_records(id) ON DELETE CASCADE,
        module TEXT NOT NULL,
        awarded_points REAL NOT NULL CHECK (awarded_points >= 0),
        maximum_points REAL NOT NULL CHECK (maximum_points > 0),
        note TEXT NOT NULL DEFAULT '',
        ordinal INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_assessment_records_session ON assessment_records(session_id, version DESC);
      CREATE INDEX IF NOT EXISTS idx_assessment_records_created ON assessment_records(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_assessment_evidence_assessment ON assessment_evidence(assessment_id, ordinal);
      CREATE INDEX IF NOT EXISTS idx_assessment_mistakes_assessment ON assessment_mistakes(assessment_id, ordinal);
      CREATE INDEX IF NOT EXISTS idx_assessment_modules_assessment ON assessment_modules(assessment_id, ordinal);
    `);
    db.pragma("user_version = 6");
  }
  if (currentVersion < 7) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS ai_run_audits (
        id TEXT PRIMARY KEY,
        provider_id TEXT NOT NULL,
        session_id TEXT NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
        response_id TEXT NOT NULL REFERENCES practice_responses(id) ON DELETE CASCADE,
        assessment_id TEXT REFERENCES assessment_records(id) ON DELETE SET NULL,
        action TEXT NOT NULL CHECK (action IN ('connection_test', 'model_discovery', 'assessment')),
        status TEXT NOT NULL CHECK (status IN ('authorized', 'running', 'succeeded', 'failed', 'expired')),
        authorized_at TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT,
        request_summary TEXT NOT NULL DEFAULT '',
        response_excerpt TEXT NOT NULL DEFAULT '',
        error_message TEXT NOT NULL DEFAULT ''
      );
      CREATE INDEX IF NOT EXISTS idx_ai_run_audits_session ON ai_run_audits(session_id, authorized_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ai_run_audits_provider ON ai_run_audits(provider_id, authorized_at DESC);
    `);
    db.pragma("user_version = 7");
  }
}

export function listImportJobs(app: App): ImportJobSummary[] {
  const db = getDatabase(app);
  const rows = db.prepare(`
    SELECT j.id, j.source_document_id AS sourceDocumentId, d.original_name AS originalName,
           d.source_kind AS kind, j.status, j.created_at AS createdAt, j.error_message AS errorMessage
    FROM import_jobs j
    JOIN source_documents d ON d.id = j.source_document_id
    ORDER BY j.created_at DESC
    LIMIT 30
  `).all() as ImportJobSummary[];
  return rows;
}

export function databaseHealth(app: App, archiveReady: boolean): ArchiveHealth {
  const db = getDatabase(app);
  const documentCount = (db.prepare("SELECT COUNT(*) AS count FROM source_documents").get() as { count: number }).count;
  const pendingReviewCount = (db.prepare("SELECT COUNT(*) AS count FROM import_jobs WHERE status = 'needs_review'").get() as { count: number }).count;
  return { mode: "desktop", databaseReady: true, archiveReady, documentCount, pendingReviewCount };
}

export function createDocumentPages(app: App, sourceDocumentId: string, pages: Array<{ pageNumber: number; ocrText: string; ocrStatus: "pending" | "extracted" | "failed" }>) {
  const db = getDatabase(app);
  const now = new Date().toISOString();
  const insert = db.prepare(`INSERT INTO document_pages (id, source_document_id, page_number, ocr_text, ocr_status, review_status, created_at, updated_at)
    VALUES (@id, @sourceDocumentId, @pageNumber, @ocrText, @ocrStatus, 'needs_review', @now, @now)`);
  const create = db.transaction(() => {
    for (const page of pages) insert.run({ id: crypto.randomUUID(), sourceDocumentId, ...page, now });
  });
  create();
}

export function listReviewDocuments(app: App): ReviewDocumentSummary[] {
  const db = getDatabase(app);
  return db.prepare(`
    SELECT d.id AS sourceDocumentId, d.original_name AS originalName, d.source_kind AS kind, d.imported_at AS importedAt,
      COUNT(p.id) AS pageCount,
      CASE WHEN SUM(CASE WHEN p.review_status = 'needs_review' THEN 1 ELSE 0 END) > 0 THEN 'needs_review' ELSE 'confirmed' END AS reviewStatus
    FROM source_documents d
    LEFT JOIN document_pages p ON p.source_document_id = d.id
    GROUP BY d.id
    ORDER BY d.imported_at DESC
  `).all() as ReviewDocumentSummary[];
}

export function getReviewDocument(app: App, sourceDocumentId: string): ReviewDocumentDetail | null {
  const db = getDatabase(app);
  const document = db.prepare(`
    SELECT d.id AS sourceDocumentId, d.original_name AS originalName, d.source_kind AS kind, d.imported_at AS importedAt,
      COUNT(p.id) AS pageCount,
      CASE WHEN SUM(CASE WHEN p.review_status = 'needs_review' THEN 1 ELSE 0 END) > 0 THEN 'needs_review' ELSE 'confirmed' END AS reviewStatus
    FROM source_documents d LEFT JOIN document_pages p ON p.source_document_id = d.id
    WHERE d.id = ? GROUP BY d.id
  `).get(sourceDocumentId) as ReviewDocumentSummary | undefined;
  if (!document) return null;
  const pageRows = db.prepare(`SELECT id, page_number AS pageNumber, COALESCE(ocr_text, '') AS ocrText, ocr_status AS ocrStatus, review_status AS reviewStatus FROM document_pages WHERE source_document_id = ? ORDER BY page_number`).all(sourceDocumentId) as Array<Omit<ReviewPage, "regions">>;
  const regions = db.prepare(`SELECT id, page_id AS pageId, x, y, width, height, ocr_text AS ocrText, ocr_status AS ocrStatus, created_at AS createdAt FROM ocr_region_runs WHERE page_id IN (SELECT id FROM document_pages WHERE source_document_id = ?) ORDER BY created_at DESC`).all(sourceDocumentId) as Array<{ id: string; pageId: string; x: number; y: number; width: number; height: number; ocrText: string; ocrStatus: OcrRegion["ocrStatus"]; createdAt: string }>;
  const pages: ReviewPage[] = pageRows.map(page => ({ ...page, regions: regions.filter(region => region.pageId === page.id).map(({ x, y, width, height, ...region }) => ({ ...region, rect: { x, y, width, height } })) }));
  const questions = db.prepare(`SELECT id, page_id AS pageId, label, title, prompt_text AS promptText, ordinal FROM question_drafts WHERE source_document_id = ? ORDER BY ordinal`).all(sourceDocumentId) as QuestionDraft[];
  const subquestions = db.prepare(`SELECT id, question_draft_id AS questionId, label, prompt_text AS text, ordinal FROM subquestion_drafts WHERE question_draft_id IN (SELECT id FROM question_drafts WHERE source_document_id = ?) ORDER BY ordinal`).all(sourceDocumentId) as Array<{ id: string; questionId: string; label: string; text: string; ordinal: number }>;
  return { ...document, pages, questions: questions.map(question => ({ ...question, subquestions: subquestions.filter(sub => sub.questionId === question.id).map(({ questionId: _questionId, ...sub }) => sub) })) };
}

export function getReviewPageSource(app: App, pageId: string) {
  const db = getDatabase(app);
  return db.prepare(`SELECT p.id AS pageId, p.page_number AS pageNumber, d.stored_name AS storedName, d.mime_type AS mimeType, d.original_name AS originalName
    FROM document_pages p JOIN source_documents d ON d.id = p.source_document_id WHERE p.id = ?`).get(pageId) as { pageId: string; pageNumber: number; storedName: string; mimeType: string; originalName: string } | undefined;
}

export function saveOcrRegionRun(app: App, input: { pageId: string; rect: NormalizedRect; sourceWidth: number; sourceHeight: number; cropSha256: string; cropPreviewDataUrl: string; ocrText: string; ocrStatus: OcrRegion["ocrStatus"] }): OcrRegion {
  const db = getDatabase(app);
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare(`INSERT INTO ocr_region_runs (id, page_id, x, y, width, height, source_width, source_height, crop_sha256, crop_preview_data_url, ocr_text, ocr_status, created_at)
    VALUES (@id, @pageId, @x, @y, @width, @height, @sourceWidth, @sourceHeight, @cropSha256, @cropPreviewDataUrl, @ocrText, @ocrStatus, @createdAt)`).run({ id, pageId: input.pageId, ...input.rect, sourceWidth: input.sourceWidth, sourceHeight: input.sourceHeight, cropSha256: input.cropSha256, cropPreviewDataUrl: input.cropPreviewDataUrl, ocrText: input.ocrText.slice(0, 250_000), ocrStatus: input.ocrStatus, createdAt });
  return { id, pageId: input.pageId, rect: input.rect, ocrText: input.ocrText.slice(0, 250_000), ocrStatus: input.ocrStatus, createdAt };
}

export function updatePageOcr(app: App, pageId: string, ocrText: string) {
  const db = getDatabase(app);
  const result = db.prepare(`UPDATE document_pages SET ocr_text = ?, ocr_status = 'reviewed', review_status = 'confirmed', updated_at = ? WHERE id = ?`).run(ocrText, new Date().toISOString(), pageId);
  if (result.changes !== 1) throw new Error("未找到需要更新的页面。");
}

export function saveQuestionDrafts(app: App, sourceDocumentId: string, questions: QuestionDraft[]) {
  const db = getDatabase(app);
  const now = new Date().toISOString();
  const save = db.transaction(() => {
    db.prepare(`DELETE FROM question_drafts WHERE source_document_id = ?`).run(sourceDocumentId);
    const questionInsert = db.prepare(`INSERT INTO question_drafts (id, source_document_id, page_id, ordinal, label, title, prompt_text, review_status, created_at, updated_at)
      VALUES (@id, @sourceDocumentId, @pageId, @ordinal, @label, @title, @promptText, 'confirmed', @now, @now)`);
    const subquestionInsert = db.prepare(`INSERT INTO subquestion_drafts (id, question_draft_id, ordinal, label, prompt_text, review_status, created_at, updated_at)
      VALUES (@id, @questionId, @ordinal, @label, @text, 'confirmed', @now, @now)`);
    questions.forEach(question => {
      const questionId = question.id ?? crypto.randomUUID();
      questionInsert.run({ ...question, id: questionId, sourceDocumentId, now });
      question.subquestions.forEach(subquestion => subquestionInsert.run({ ...subquestion, id: subquestion.id ?? crypto.randomUUID(), questionId, now }));
    });
    db.prepare(`UPDATE import_jobs SET status = 'archived', updated_at = ? WHERE source_document_id = ?`).run(now, sourceDocumentId);
  });
  save();
}

export function savePracticeResponse(app: App, input: SavePracticeResponseInput): PracticeSessionDetail {
  const db = getDatabase(app);
  const now = new Date().toISOString();
  const sessionId = input.sessionId ?? crypto.randomUUID();
  const transaction = db.transaction(() => {
    const existing = db.prepare("SELECT id FROM practice_sessions WHERE id = ?").get(sessionId);
    if (!existing) db.prepare(`INSERT INTO practice_sessions (id, reference_key, title, status, started_at, updated_at) VALUES (?, ?, ?, 'active', ?, ?)`).run(sessionId, input.referenceKey, input.title, now, now);
    const version = (db.prepare("SELECT COALESCE(MAX(version), 0) AS value FROM practice_responses WHERE session_id = ?").get(sessionId) as { value: number }).value + 1;
    db.prepare(`INSERT INTO practice_responses (id, session_id, answer_format, content, status, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(crypto.randomUUID(), sessionId, input.answerFormat, input.content, input.status, version, now, now);
    db.prepare(`UPDATE practice_sessions SET status = ?, updated_at = ?, submitted_at = CASE WHEN ? = 'submitted' THEN ? ELSE submitted_at END WHERE id = ?`)
      .run(input.status === "submitted" ? "submitted" : "active", now, input.status, now, sessionId);
  });
  transaction();
  return getPracticeSession(app, sessionId)!;
}

export function createPaperResponse(app: App, sessionId: string, referenceKey: string, title: string) {
  const db = getDatabase(app);
  const now = new Date().toISOString();
  const resolvedSessionId = sessionId || crypto.randomUUID();
  const existing = db.prepare("SELECT id FROM practice_sessions WHERE id = ?").get(resolvedSessionId);
  if (!existing) db.prepare(`INSERT INTO practice_sessions (id, reference_key, title, status, started_at, updated_at) VALUES (?, ?, ?, 'active', ?, ?)`).run(resolvedSessionId, referenceKey, title, now, now);
  const version = (db.prepare("SELECT COALESCE(MAX(version), 0) AS value FROM practice_responses WHERE session_id = ?").get(resolvedSessionId) as { value: number }).value + 1;
  const responseId = crypto.randomUUID();
  db.prepare(`INSERT INTO practice_responses (id, session_id, answer_format, content, status, version, created_at, updated_at) VALUES (?, ?, 'paper_attachment', '', 'draft', ?, ?, ?)`).run(responseId, resolvedSessionId, version, now, now);
  db.prepare("UPDATE practice_sessions SET updated_at = ? WHERE id = ?").run(now, resolvedSessionId);
  return { sessionId: resolvedSessionId, responseId };
}

export function addResponseAttachment(app: App, input: Omit<ResponseAttachmentSummary, "createdAt"> & { storedName: string; sha256: string }) {
  const db = getDatabase(app);
  db.prepare(`INSERT INTO response_attachments (id, response_id, original_name, stored_name, sha256, mime_type, size_bytes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(input.id, input.responseId, input.originalName, input.storedName, input.sha256, input.mimeType, input.sizeBytes, new Date().toISOString());
}

export function getPracticeSession(app: App, sessionId: string): PracticeSessionDetail | null {
  const db = getDatabase(app);
  const session = db.prepare(`SELECT id, reference_key AS referenceKey, title, status, started_at AS startedAt, updated_at AS updatedAt FROM practice_sessions WHERE id = ?`).get(sessionId) as Omit<PracticeSessionDetail, "responses"> | undefined;
  if (!session) return null;
  const responses = db.prepare(`SELECT id, session_id AS sessionId, answer_format AS answerFormat, content, status, version, created_at AS createdAt FROM practice_responses WHERE session_id = ? ORDER BY version DESC`).all(sessionId) as Omit<PracticeResponse, "attachments">[];
  const attachments = db.prepare(`SELECT id, response_id AS responseId, original_name AS originalName, mime_type AS mimeType, size_bytes AS sizeBytes, created_at AS createdAt FROM response_attachments WHERE response_id IN (SELECT id FROM practice_responses WHERE session_id = ?) ORDER BY created_at DESC`).all(sessionId) as ResponseAttachmentSummary[];
  return { ...session, responses: responses.map(response => ({ ...response, attachments: attachments.filter(attachment => attachment.responseId === response.id) })) };
}

export function getDataCounts(app: App) {
  const db = getDatabase(app);
  const count = (sql: string) => (db.prepare(sql).get() as { count: number }).count;
  return { documentCount: count("SELECT COUNT(*) AS count FROM source_documents"), responseCount: count("SELECT COUNT(*) AS count FROM practice_responses"), attachmentCount: count("SELECT COUNT(*) AS count FROM response_attachments") };
}

export function listAssessmentSessions(app: App): PracticeSessionDetail[] {
  const db = getDatabase(app);
  const rows = db.prepare("SELECT id FROM practice_sessions ORDER BY updated_at DESC LIMIT 30").all() as Array<{ id: string }>;
  return rows.map(row => getPracticeSession(app, row.id)).filter((session): session is PracticeSessionDetail => Boolean(session));
}

const assessmentSummarySql = `SELECT a.id, a.session_id AS sessionId, a.response_id AS responseId, s.reference_key AS referenceKey, s.title,
  r.version AS responseVersion, r.answer_format AS answerFormat, a.origin, a.status, a.version, a.score_awarded AS scoreAwarded,
  a.score_maximum AS scoreMaximum, a.overall_feedback AS overallFeedback, a.summary, a.created_at AS createdAt, a.confirmed_at AS confirmedAt
  FROM assessment_records a JOIN practice_sessions s ON s.id = a.session_id JOIN practice_responses r ON r.id = a.response_id`;

export function listAssessmentRecords(app: App): AssessmentRecordSummary[] {
  return getDatabase(app).prepare(`${assessmentSummarySql} ORDER BY a.created_at DESC LIMIT 40`).all() as AssessmentRecordSummary[];
}

export function getAssessmentRecord(app: App, assessmentId: string): AssessmentRecordDetail | null {
  const db = getDatabase(app);
  const summary = db.prepare(`${assessmentSummarySql} WHERE a.id = ?`).get(assessmentId) as AssessmentRecordSummary | undefined;
  if (!summary) return null;
  const evidence = db.prepare(`SELECT id, criterion, maximum_points AS maximumPoints, awarded_points AS awardedPoints, rationale, response_quote AS responseQuote, ordinal FROM assessment_evidence WHERE assessment_id = ? ORDER BY ordinal`).all(assessmentId) as AssessmentRecordDetail["evidence"];
  const mistakes = db.prepare(`SELECT id, category, module, severity, note, ordinal FROM assessment_mistakes WHERE assessment_id = ? ORDER BY ordinal`).all(assessmentId) as AssessmentRecordDetail["mistakes"];
  const modules = db.prepare(`SELECT id, module, awarded_points AS awardedPoints, maximum_points AS maximumPoints, note, ordinal FROM assessment_modules WHERE assessment_id = ? ORDER BY ordinal`).all(assessmentId) as AssessmentRecordDetail["modules"];
  return { ...summary, confirmedAt: summary.confirmedAt ?? undefined, evidence, mistakes, modules };
}

function saveAssessmentRecordWithOrigin(app: App, input: SaveAssessmentInput, origin: "manual" | "ai"): AssessmentRecordDetail {
  const db = getDatabase(app);
  const now = new Date().toISOString();
  const response = db.prepare("SELECT id FROM practice_responses WHERE id = ? AND session_id = ?").get(input.responseId, input.sessionId);
  if (!response) throw new Error("所选答卷版本不属于当前训练会话。");
  const assessmentId = crypto.randomUUID();
  const transaction = db.transaction(() => {
    const version = (db.prepare("SELECT COALESCE(MAX(version), 0) AS value FROM assessment_records WHERE session_id = ?").get(input.sessionId) as { value: number }).value + 1;
    db.prepare(`INSERT INTO assessment_records (id, session_id, response_id, origin, status, version, score_awarded, score_maximum, overall_feedback, summary, created_at, confirmed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(assessmentId, input.sessionId, input.responseId, origin, input.status, version, input.scoreAwarded, input.scoreMaximum, input.overallFeedback.slice(0, 12_000), input.summary.slice(0, 4_000), now, input.status === "confirmed" ? now : null);
    const evidence = db.prepare(`INSERT INTO assessment_evidence (id, assessment_id, criterion, maximum_points, awarded_points, rationale, response_quote, ordinal) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    const mistakes = db.prepare(`INSERT INTO assessment_mistakes (id, assessment_id, category, module, severity, note, ordinal) VALUES (?, ?, ?, ?, ?, ?, ?)`);
    const modules = db.prepare(`INSERT INTO assessment_modules (id, assessment_id, module, awarded_points, maximum_points, note, ordinal) VALUES (?, ?, ?, ?, ?, ?, ?)`);
    for (const item of input.evidence) evidence.run(crypto.randomUUID(), assessmentId, item.criterion.slice(0, 500), item.maximumPoints, item.awardedPoints, item.rationale.slice(0, 4_000), item.responseQuote.slice(0, 4_000), item.ordinal);
    for (const item of input.mistakes) mistakes.run(crypto.randomUUID(), assessmentId, item.category, item.module.slice(0, 180), item.severity, item.note.slice(0, 4_000), item.ordinal);
    for (const item of input.modules) modules.run(crypto.randomUUID(), assessmentId, item.module.slice(0, 180), item.awardedPoints, item.maximumPoints, item.note.slice(0, 2_000), item.ordinal);
  });
  transaction();
  return getAssessmentRecord(app, assessmentId)!;
}

export function saveAssessmentRecord(app: App, input: SaveAssessmentInput): AssessmentRecordDetail { return saveAssessmentRecordWithOrigin(app, input, "manual"); }
export function saveAiAssessmentDraft(app: App, input: SaveAssessmentInput): AssessmentRecordDetail { return saveAssessmentRecordWithOrigin(app, { ...input, status: "draft" }, "ai"); }

export function createAiRunAudit(app: App, input: { id: string; providerId: string; sessionId: string; responseId: string; action: "connection_test" | "model_discovery" | "assessment"; status: "authorized" | "running" | "succeeded" | "failed" | "expired"; requestSummary: string }) {
  getDatabase(app).prepare(`INSERT INTO ai_run_audits (id, provider_id, session_id, response_id, action, status, authorized_at, request_summary) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(input.id, input.providerId, input.sessionId, input.responseId, input.action, input.status, new Date().toISOString(), input.requestSummary.slice(0, 12_000));
}

export function updateAiRunAudit(app: App, auditId: string, input: { status: "running" | "succeeded" | "failed" | "expired"; assessmentId?: string; responseExcerpt?: string; errorMessage?: string }) {
  const now = new Date().toISOString();
  getDatabase(app).prepare(`UPDATE ai_run_audits SET status = ?, started_at = CASE WHEN ? = 'running' THEN ? ELSE started_at END, completed_at = CASE WHEN ? IN ('succeeded', 'failed', 'expired') THEN ? ELSE completed_at END, assessment_id = COALESCE(?, assessment_id), response_excerpt = CASE WHEN ? IS NULL THEN response_excerpt ELSE ? END, error_message = CASE WHEN ? IS NULL THEN error_message ELSE ? END WHERE id = ?`)
    .run(input.status, input.status, now, input.status, now, input.assessmentId ?? null, input.responseExcerpt ?? null, (input.responseExcerpt ?? "").slice(0, 12_000), input.errorMessage ?? null, (input.errorMessage ?? "").slice(0, 2_000), auditId);
}

export function getAssessmentDashboard(app: App): AssessmentDashboard {
  const db = getDatabase(app);
  const totals = db.prepare(`SELECT COUNT(*) AS assessmentCount, SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) AS confirmedCount,
    SUM(CASE WHEN status = 'confirmed' THEN score_awarded ELSE 0 END) AS awarded, SUM(CASE WHEN status = 'confirmed' THEN score_maximum ELSE 0 END) AS maximum
    FROM assessment_records`).get() as { assessmentCount: number; confirmedCount: number; awarded: number | null; maximum: number | null };
  const latest = db.prepare("SELECT score_awarded / score_maximum AS scoreRate FROM assessment_records WHERE status = 'confirmed' ORDER BY created_at DESC LIMIT 1").get() as { scoreRate: number } | undefined;
  const history = db.prepare(`SELECT id AS assessmentId, created_at AS createdAt, score_awarded / score_maximum AS scoreRate FROM assessment_records WHERE status = 'confirmed' ORDER BY created_at ASC LIMIT 30`).all() as AssessmentDashboard["history"];
  const modules = db.prepare(`SELECT m.module, SUM(m.awarded_points) AS awardedPoints, SUM(m.maximum_points) AS maximumPoints, SUM(m.awarded_points) / SUM(m.maximum_points) AS scoreRate
    FROM assessment_modules m JOIN assessment_records a ON a.id = m.assessment_id WHERE a.status = 'confirmed' GROUP BY m.module ORDER BY maximumPoints DESC`).all() as AssessmentDashboard["modules"];
  const mistakes = db.prepare(`SELECT m.category, COUNT(*) AS count FROM assessment_mistakes m JOIN assessment_records a ON a.id = m.assessment_id WHERE a.status = 'confirmed' GROUP BY m.category ORDER BY count DESC`).all() as AssessmentDashboard["mistakes"];
  return { assessmentCount: totals.assessmentCount, confirmedCount: totals.confirmedCount ?? 0, weightedScoreRate: totals.maximum ? totals.awarded! / totals.maximum : null, latestScoreRate: latest?.scoreRate ?? null, recentAssessments: listAssessmentRecords(app), history, modules, mistakes, aiStatus: "not_configured" };
}

export function writeBackupAudit(app: App, action: "export" | "preflight" | "restore", backupId: string | null, status: "success" | "failed", summary: unknown) {
  getDatabase(app).prepare(`INSERT INTO backup_audits (id, action, backup_id, status, summary_json, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(crypto.randomUUID(), action, backupId, status, JSON.stringify(summary), new Date().toISOString());
}

export function saveInkResponse(app: App, input: SaveInkResponseInput): InkSaveResult {
  const db = getDatabase(app);
  const now = new Date().toISOString();
  const sessionId = input.sessionId ?? crypto.randomUUID();
  let responseId = "";
  const transaction = db.transaction(() => {
    const existing = db.prepare("SELECT id FROM practice_sessions WHERE id = ?").get(sessionId);
    if (!existing) db.prepare(`INSERT INTO practice_sessions (id, reference_key, title, status, started_at, updated_at) VALUES (?, ?, ?, 'active', ?, ?)`).run(sessionId, input.referenceKey, input.title, now, now);
    const version = (db.prepare("SELECT COALESCE(MAX(version), 0) AS value FROM practice_responses WHERE session_id = ?").get(sessionId) as { value: number }).value + 1;
    responseId = crypto.randomUUID();
    const strokeCount = input.layers.reduce((sum, layer) => sum + layer.strokes.length, 0);
    db.prepare(`INSERT INTO practice_responses (id, session_id, answer_format, content, status, version, created_at, updated_at) VALUES (?, ?, 'handwritten', ?, ?, ?, ?, ?)`)
      .run(responseId, sessionId, `笔迹作答：${strokeCount} 个笔画`, input.status, version, now, now);
    db.prepare(`UPDATE practice_sessions SET status = ?, updated_at = ?, submitted_at = CASE WHEN ? = 'submitted' THEN ? ELSE submitted_at END WHERE id = ?`)
      .run(input.status === "submitted" ? "submitted" : "active", now, input.status, now, sessionId);
    const insertLayer = db.prepare(`INSERT INTO ink_layers (id, response_id, title, ordinal, is_visible, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`);
    const insertStroke = db.prepare(`INSERT INTO ink_strokes (id, layer_id, ordinal, tool, color, width, points_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const layer of input.layers) {
      const layerId = layer.id ?? crypto.randomUUID();
      insertLayer.run(layerId, responseId, layer.title.slice(0, 120), layer.ordinal, layer.visible ? 1 : 0, now, now);
      for (const stroke of layer.strokes) insertStroke.run(stroke.id ?? crypto.randomUUID(), layerId, stroke.ordinal, stroke.tool, stroke.color, stroke.width, JSON.stringify(stroke.points), now);
    }
    db.prepare(`INSERT INTO ink_snapshots (id, response_id, canvas_width, canvas_height, preview_svg, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(crypto.randomUUID(), responseId, input.canvasWidth, input.canvasHeight, input.previewSvg.slice(0, 2_000_000), now);
  });
  transaction();
  return { session: getPracticeSession(app, sessionId)!, ink: getInkResponse(app, responseId)! };
}

export function getInkResponse(app: App, responseId: string): InkResponseDetail | null {
  const db = getDatabase(app);
  const snapshot = db.prepare(`SELECT s.response_id AS responseId, r.session_id AS sessionId, s.canvas_width AS canvasWidth, s.canvas_height AS canvasHeight, s.preview_svg AS previewSvg, s.created_at AS createdAt FROM ink_snapshots s JOIN practice_responses r ON r.id = s.response_id WHERE s.response_id = ?`).get(responseId) as Omit<InkResponseDetail, "layers"> | undefined;
  if (!snapshot) return null;
  const layers = db.prepare(`SELECT id, title, ordinal, is_visible AS visible FROM ink_layers WHERE response_id = ? ORDER BY ordinal`).all(responseId) as Array<{ id: string; title: string; ordinal: number; visible: number }>;
  const strokes = db.prepare(`SELECT id, layer_id AS layerId, ordinal, tool, color, width, points_json AS pointsJson FROM ink_strokes WHERE layer_id IN (SELECT id FROM ink_layers WHERE response_id = ?) ORDER BY ordinal`).all(responseId) as Array<{ id: string; layerId: string; ordinal: number; tool: "pen" | "eraser"; color: string; width: number; pointsJson: string }>;
  return { ...snapshot, layers: layers.map(layer => ({ ...layer, visible: Boolean(layer.visible), strokes: strokes.filter(stroke => stroke.layerId === layer.id).map(({ layerId: _layerId, pointsJson, ...stroke }) => ({ ...stroke, points: JSON.parse(pointsJson) } as InkStroke)) })) };
}
