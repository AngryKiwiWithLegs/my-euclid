import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { App } from "electron";
import type { AbilitySnapshot, AdaptiveRecommendation, AdaptiveTrainingProfile, ArchiveHealth, AssessmentDashboard, AssessmentRecordDetail, AssessmentRecordSummary, CreateMockExamInput, ImportJobSummary, InkLayer, InkResponseDetail, InkSaveResult, InkStroke, IrtItemParameter, KnowledgeEdge, KnowledgeNode, MockExamDetail, MockExamItem, MockExamStatus, MockExamSummary, NormalizedRect, OcrRegion, PracticeResponse, PracticeSessionDetail, PublishQuestionDraftInput, QuestionBankFilter, QuestionBankQuestion, QuestionBankStatus, QuestionDraft, QuestionKnowledgeMapping, ResponseAttachmentSummary, ReviewDocumentDetail, ReviewDocumentSummary, ReviewPage, SaveAssessmentInput, SaveInkResponseInput, SavePracticeResponseInput, SaveIrtItemParameterInput, SaveKnowledgeEdgeInput, SaveKnowledgeNodeInput, TutorPlan, TutorSession } from "./types.js";

let database: Database.Database | null = null;

export function getDatabase(app: App) {
  if (database) return database;
  const databasePath = path.join(app.getPath("userData"), "my-euclid.sqlite");
  mkdirSync(path.dirname(databasePath), { recursive: true });
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
  if (currentVersion < 8) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS question_bank (
        id TEXT PRIMARY KEY,
        source_question_draft_id TEXT NOT NULL UNIQUE REFERENCES question_drafts(id) ON DELETE RESTRICT,
        source_document_id TEXT NOT NULL REFERENCES source_documents(id) ON DELETE RESTRICT,
        page_id TEXT NOT NULL REFERENCES document_pages(id) ON DELETE RESTRICT,
        status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'archived')),
        source_name TEXT NOT NULL DEFAULT '',
        competition_year INTEGER,
        question_number INTEGER,
        primary_topic TEXT NOT NULL DEFAULT '',
        secondary_topics_json TEXT NOT NULL DEFAULT '[]',
        difficulty REAL,
        question_type TEXT NOT NULL DEFAULT '',
        methods_json TEXT NOT NULL DEFAULT '[]',
        proof_required INTEGER NOT NULL DEFAULT 0,
        estimated_minutes INTEGER,
        maximum_points REAL,
        scoring_notes TEXT NOT NULL DEFAULT '',
        priority INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS question_bank_subquestions (
        id TEXT PRIMARY KEY,
        question_id TEXT NOT NULL REFERENCES question_bank(id) ON DELETE CASCADE,
        source_subquestion_draft_id TEXT UNIQUE REFERENCES subquestion_drafts(id) ON DELETE SET NULL,
        ordinal INTEGER NOT NULL,
        label TEXT NOT NULL,
        prompt_text TEXT NOT NULL,
        maximum_points REAL
      );
      CREATE TABLE IF NOT EXISTS question_bank_tags (
        id TEXT PRIMARY KEY,
        question_id TEXT NOT NULL REFERENCES question_bank(id) ON DELETE CASCADE,
        category TEXT NOT NULL,
        value TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'ai_suggestion')),
        UNIQUE(question_id, category, value)
      );
      CREATE INDEX IF NOT EXISTS idx_question_bank_status ON question_bank(status, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_question_bank_source ON question_bank(source_document_id);
      CREATE INDEX IF NOT EXISTS idx_question_bank_topic ON question_bank(primary_topic, difficulty);
      CREATE INDEX IF NOT EXISTS idx_question_bank_subquestions_question ON question_bank_subquestions(question_id, ordinal);
      CREATE INDEX IF NOT EXISTS idx_question_bank_tags_question ON question_bank_tags(question_id, category);
    `);
    db.pragma("user_version = 8");
  }
  if (currentVersion < 9) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS mock_exams (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'submitted', 'archived')),
        duration_seconds INTEGER NOT NULL CHECK (duration_seconds >= 60 AND duration_seconds <= 21600),
        started_at TEXT,
        submitted_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS mock_exam_items (
        id TEXT PRIMARY KEY,
        exam_id TEXT NOT NULL REFERENCES mock_exams(id) ON DELETE CASCADE,
        question_id TEXT NOT NULL REFERENCES question_bank(id) ON DELETE RESTRICT,
        practice_session_id TEXT NOT NULL UNIQUE REFERENCES practice_sessions(id) ON DELETE RESTRICT,
        ordinal INTEGER NOT NULL,
        maximum_points REAL,
        title_snapshot TEXT NOT NULL,
        label_snapshot TEXT NOT NULL,
        prompt_snapshot TEXT NOT NULL,
        primary_topic_snapshot TEXT NOT NULL,
        difficulty_snapshot REAL,
        UNIQUE(exam_id, ordinal),
        UNIQUE(exam_id, question_id)
      );
      CREATE INDEX IF NOT EXISTS idx_mock_exams_status ON mock_exams(status, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_mock_exam_items_exam ON mock_exam_items(exam_id, ordinal);
    `);
    db.pragma("user_version = 9");
  }
  if (currentVersion < 10) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_nodes (
        id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, description TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS knowledge_edges (
        id TEXT PRIMARY KEY, prerequisite_node_id TEXT NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
        dependent_node_id TEXT NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
        strength REAL NOT NULL DEFAULT 1 CHECK (strength > 0 AND strength <= 1),
        UNIQUE(prerequisite_node_id, dependent_node_id), CHECK (prerequisite_node_id <> dependent_node_id)
      );
      CREATE TABLE IF NOT EXISTS question_irt_parameters (
        question_id TEXT PRIMARY KEY REFERENCES question_bank(id) ON DELETE CASCADE,
        difficulty REAL NOT NULL CHECK (difficulty >= -4 AND difficulty <= 4),
        discrimination REAL NOT NULL CHECK (discrimination > 0 AND discrimination <= 4),
        guessing REAL NOT NULL DEFAULT 0 CHECK (guessing >= 0 AND guessing < 0.5),
        source TEXT NOT NULL CHECK (source IN ('manual', 'heuristic')), updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS question_knowledge_mappings (
        question_id TEXT NOT NULL REFERENCES question_bank(id) ON DELETE CASCADE,
        node_id TEXT NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
        weight REAL NOT NULL DEFAULT 1 CHECK (weight > 0 AND weight <= 1),
        PRIMARY KEY(question_id, node_id)
      );
      CREATE TABLE IF NOT EXISTS learner_ability_snapshots (
        node_id TEXT PRIMARY KEY REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
        theta REAL NOT NULL, standard_error REAL NOT NULL, evidence_count INTEGER NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_question_knowledge_node ON question_knowledge_mappings(node_id);
      CREATE INDEX IF NOT EXISTS idx_knowledge_edges_dependent ON knowledge_edges(dependent_node_id);
    `);
    db.pragma("user_version = 10");
  }
  if (currentVersion < 11) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS tutor_sessions (
        id TEXT PRIMARY KEY, question_id TEXT NOT NULL REFERENCES question_bank(id) ON DELETE RESTRICT,
        provider_id TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN ('active','archived')),
        question_text TEXT NOT NULL, answer_text TEXT NOT NULL DEFAULT '', plan_json TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS tutor_messages (
        id TEXT PRIMARY KEY, tutor_session_id TEXT NOT NULL REFERENCES tutor_sessions(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('user','assistant')), content TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_tutor_sessions_question ON tutor_sessions(question_id, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_tutor_messages_session ON tutor_messages(tutor_session_id, created_at);
    `);
    db.pragma("user_version = 11");
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
    const questionInsert = db.prepare(`INSERT INTO question_drafts (id, source_document_id, page_id, ordinal, label, title, prompt_text, review_status, created_at, updated_at)
      VALUES (@id, @sourceDocumentId, @pageId, @ordinal, @label, @title, @promptText, 'confirmed', @now, @now)
      ON CONFLICT(id) DO UPDATE SET page_id = excluded.page_id, ordinal = excluded.ordinal, label = excluded.label, title = excluded.title, prompt_text = excluded.prompt_text, review_status = 'confirmed', updated_at = excluded.updated_at`);
    const subquestionInsert = db.prepare(`INSERT INTO subquestion_drafts (id, question_draft_id, ordinal, label, prompt_text, review_status, created_at, updated_at)
      VALUES (@id, @questionId, @ordinal, @label, @text, 'confirmed', @now, @now)
      ON CONFLICT(id) DO UPDATE SET question_draft_id = excluded.question_draft_id, ordinal = excluded.ordinal, label = excluded.label, prompt_text = excluded.prompt_text, review_status = 'confirmed', updated_at = excluded.updated_at`);
    questions.forEach(question => {
      const questionId = question.id ?? crypto.randomUUID();
      questionInsert.run({ ...question, id: questionId, sourceDocumentId, now });
      question.subquestions.forEach(subquestion => subquestionInsert.run({ ...subquestion, id: subquestion.id ?? crypto.randomUUID(), questionId, now }));
    });
    db.prepare(`UPDATE import_jobs SET status = 'archived', updated_at = ? WHERE source_document_id = ?`).run(now, sourceDocumentId);
  });
  save();
}

function parseJsonList(value: string | null | undefined) {
  try { const parsed = JSON.parse(value ?? "[]"); return Array.isArray(parsed) ? parsed.filter(item => typeof item === "string") : []; } catch { return []; }
}

function hydrateQuestionBank(db: Database.Database, rows: Array<Record<string, unknown>>): QuestionBankQuestion[] {
  if (!rows.length) return [];
  const ids = rows.map(row => String(row.id));
  const placeholders = ids.map(() => "?").join(",");
  const subquestions = db.prepare(`SELECT id, question_id AS questionId, source_subquestion_draft_id AS sourceSubquestionDraftId, ordinal, label, prompt_text AS promptText, maximum_points AS maximumPoints FROM question_bank_subquestions WHERE question_id IN (${placeholders}) ORDER BY ordinal`).all(...ids) as Array<{ id: string; questionId: string; sourceSubquestionDraftId?: string; ordinal: number; label: string; promptText: string; maximumPoints?: number }>;
  const tags = db.prepare(`SELECT id, question_id AS questionId, category, value, source FROM question_bank_tags WHERE question_id IN (${placeholders}) ORDER BY category, value`).all(...ids) as Array<{ id: string; questionId: string; category: string; value: string; source: "manual" | "ai_suggestion" }>;
  return rows.map(row => ({
    id: String(row.id), sourceQuestionDraftId: String(row.sourceQuestionDraftId), sourceDocumentId: String(row.sourceDocumentId), pageId: String(row.pageId), originalName: String(row.originalName), pageNumber: Number(row.pageNumber), label: String(row.label), title: String(row.title), promptText: String(row.promptText), status: row.status as QuestionBankStatus, sourceName: String(row.sourceName ?? ""), competitionYear: row.competitionYear === null || row.competitionYear === undefined ? undefined : Number(row.competitionYear), questionNumber: row.questionNumber === null || row.questionNumber === undefined ? undefined : Number(row.questionNumber), primaryTopic: String(row.primaryTopic ?? ""), secondaryTopics: parseJsonList(row.secondaryTopicsJson as string), difficulty: row.difficulty === null || row.difficulty === undefined ? undefined : Number(row.difficulty), questionType: String(row.questionType ?? ""), methods: parseJsonList(row.methodsJson as string), proofRequired: Boolean(row.proofRequired), estimatedMinutes: row.estimatedMinutes === null || row.estimatedMinutes === undefined ? undefined : Number(row.estimatedMinutes), maximumPoints: row.maximumPoints === null || row.maximumPoints === undefined ? undefined : Number(row.maximumPoints), scoringNotes: String(row.scoringNotes ?? ""), priority: Number(row.priority ?? 0), tags: tags.filter(tag => tag.questionId === row.id).map(({ questionId: _questionId, ...tag }) => tag), subquestions: subquestions.filter(subquestion => subquestion.questionId === row.id).map(({ questionId: _questionId, ...subquestion }) => subquestion), createdAt: String(row.createdAt), updatedAt: String(row.updatedAt),
  }));
}

const questionBankSelect = `
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

export function publishQuestionDrafts(app: App, sourceDocumentId: string, inputs: PublishQuestionDraftInput[]) {
  const db = getDatabase(app);
  const now = new Date().toISOString();
  const publish = db.transaction(() => {
    const findDraft = db.prepare(`SELECT id, page_id AS pageId FROM question_drafts WHERE id = ? AND source_document_id = ? AND review_status = 'confirmed'`);
    const findSubquestion = db.prepare(`SELECT id FROM subquestion_drafts WHERE id = ? AND question_draft_id = ? AND review_status = 'confirmed'`);
    const upsert = db.prepare(`INSERT INTO question_bank (id, source_question_draft_id, source_document_id, page_id, status, source_name, competition_year, question_number, primary_topic, secondary_topics_json, difficulty, question_type, methods_json, proof_required, estimated_minutes, maximum_points, scoring_notes, priority, created_at, updated_at)
      VALUES (@id, @sourceQuestionDraftId, @sourceDocumentId, @pageId, 'published', @sourceName, @competitionYear, @questionNumber, @primaryTopic, @secondaryTopicsJson, @difficulty, @questionType, @methodsJson, @proofRequired, @estimatedMinutes, @maximumPoints, @scoringNotes, @priority, @now, @now)
      ON CONFLICT(source_question_draft_id) DO UPDATE SET status = 'published', source_name = excluded.source_name, competition_year = excluded.competition_year, question_number = excluded.question_number, primary_topic = excluded.primary_topic, secondary_topics_json = excluded.secondary_topics_json, difficulty = excluded.difficulty, question_type = excluded.question_type, methods_json = excluded.methods_json, proof_required = excluded.proof_required, estimated_minutes = excluded.estimated_minutes, maximum_points = excluded.maximum_points, scoring_notes = excluded.scoring_notes, priority = excluded.priority, updated_at = excluded.updated_at`);
    const findBank = db.prepare(`SELECT id FROM question_bank WHERE source_question_draft_id = ?`);
    const clearSubs = db.prepare(`DELETE FROM question_bank_subquestions WHERE question_id = ?`);
    const clearTags = db.prepare(`DELETE FROM question_bank_tags WHERE question_id = ?`);
    const insertSub = db.prepare(`INSERT INTO question_bank_subquestions (id, question_id, source_subquestion_draft_id, ordinal, label, prompt_text, maximum_points) VALUES (@id, @questionId, @sourceSubquestionDraftId, @ordinal, @label, @promptText, @maximumPoints)`);
    const insertTag = db.prepare(`INSERT OR IGNORE INTO question_bank_tags (id, question_id, category, value, source) VALUES (@id, @questionId, @category, @value, @source)`);
    for (const input of inputs) {
      const draft = findDraft.get(input.questionDraftId, sourceDocumentId) as { id: string; pageId: string } | undefined;
      if (!draft) throw new Error("只能发布当前资料中已确认的题目草案。");
      const meta = input.metadata;
      if (!meta.sourceName.trim() || !meta.primaryTopic.trim() || !meta.questionType.trim()) throw new Error("发布题库前必须填写来源、主考点和题型。");
      if (meta.difficulty !== undefined && (!Number.isFinite(meta.difficulty) || meta.difficulty < 1 || meta.difficulty > 5)) throw new Error("难度必须为 1 到 5。");
      if (meta.estimatedMinutes !== undefined && (!Number.isInteger(meta.estimatedMinutes) || meta.estimatedMinutes < 1 || meta.estimatedMinutes > 300)) throw new Error("预计用时必须为 1 到 300 分钟。");
      if (meta.maximumPoints !== undefined && (!Number.isFinite(meta.maximumPoints) || meta.maximumPoints <= 0 || meta.maximumPoints > 100)) throw new Error("题目满分必须为正数且不超过 100。");
      const id = (findBank.get(draft.id) as { id: string } | undefined)?.id ?? crypto.randomUUID();
      upsert.run({ id, sourceQuestionDraftId: draft.id, sourceDocumentId, pageId: draft.pageId, sourceName: meta.sourceName.trim(), competitionYear: meta.competitionYear ?? null, questionNumber: meta.questionNumber ?? null, primaryTopic: meta.primaryTopic.trim(), secondaryTopicsJson: JSON.stringify(meta.secondaryTopics.map(value => value.trim()).filter(Boolean)), difficulty: meta.difficulty ?? null, questionType: meta.questionType.trim(), methodsJson: JSON.stringify(meta.methods.map(value => value.trim()).filter(Boolean)), proofRequired: meta.proofRequired ? 1 : 0, estimatedMinutes: meta.estimatedMinutes ?? null, maximumPoints: meta.maximumPoints ?? null, scoringNotes: meta.scoringNotes.trim(), priority: Math.max(0, Math.min(5, Math.round(meta.priority))), now });
      clearSubs.run(id); clearTags.run(id);
      meta.subquestions.forEach((subquestion, index) => {
        if (subquestion.sourceSubquestionDraftId && !findSubquestion.get(subquestion.sourceSubquestionDraftId, draft.id)) throw new Error("小问来源不属于当前题目草案。");
        insertSub.run({ id: crypto.randomUUID(), questionId: id, sourceSubquestionDraftId: subquestion.sourceSubquestionDraftId ?? null, ordinal: index + 1, label: subquestion.label.trim() || `(${String.fromCharCode(97 + index)})`, promptText: subquestion.promptText.trim(), maximumPoints: subquestion.maximumPoints ?? null });
      });
      meta.tags.forEach(tag => { if (tag.category.trim() && tag.value.trim()) insertTag.run({ id: crypto.randomUUID(), questionId: id, category: tag.category.trim(), value: tag.value.trim(), source: tag.source ?? "manual" }); });
    }
  });
  publish();
  return listQuestionBank(app, { limit: 500 }).filter(question => inputs.some(input => question.sourceQuestionDraftId === input.questionDraftId));
}

export function listQuestionBank(app: App, filter: QuestionBankFilter = {}) {
  const db = getDatabase(app); const clauses = ["b.status = 'published'"]; const values: Array<string | number> = [];
  if (filter.query?.trim()) { clauses.push("(q.label LIKE ? OR q.title LIKE ? OR q.prompt_text LIKE ? OR b.primary_topic LIKE ? OR b.question_type LIKE ?)"); const query = `%${filter.query.trim()}%`; values.push(query, query, query, query, query); }
  if (filter.sourceName?.trim()) { clauses.push("b.source_name = ?"); values.push(filter.sourceName.trim()); }
  if (filter.competitionYear !== undefined) { clauses.push("b.competition_year = ?"); values.push(filter.competitionYear); }
  if (filter.primaryTopic?.trim()) { clauses.push("b.primary_topic = ?"); values.push(filter.primaryTopic.trim()); }
  if (filter.difficulty !== undefined) { clauses.push("b.difficulty = ?"); values.push(filter.difficulty); }
  if (filter.questionType?.trim()) { clauses.push("b.question_type = ?"); values.push(filter.questionType.trim()); }
  if (filter.proofRequired !== undefined) { clauses.push("b.proof_required = ?"); values.push(filter.proofRequired ? 1 : 0); }
  const limit = Math.max(1, Math.min(filter.limit ?? 200, 500));
  const rows = db.prepare(`${questionBankSelect} WHERE ${clauses.join(" AND ")} ORDER BY b.priority DESC, b.competition_year DESC, b.question_number ASC, b.updated_at DESC LIMIT ?`).all(...values, limit) as Array<Record<string, unknown>>;
  return hydrateQuestionBank(db, rows);
}

export function getQuestionBankQuestion(app: App, questionId: string) {
  const db = getDatabase(app); const row = db.prepare(`${questionBankSelect} WHERE b.id = ?`).get(questionId) as Record<string, unknown> | undefined;
  return row ? hydrateQuestionBank(db, [row])[0] : null;
}

function hydrateMockExams(db: Database.Database, rows: Array<Record<string, unknown>>): MockExamDetail[] {
  if (!rows.length) return [];
  const ids = rows.map(row => String(row.id)); const placeholders = ids.map(() => "?").join(",");
  const items = db.prepare(`SELECT i.id, i.exam_id AS examId, i.ordinal, i.question_id AS questionId, i.maximum_points AS maximumPoints, i.title_snapshot AS title, i.label_snapshot AS label, i.prompt_snapshot AS promptText, i.primary_topic_snapshot AS primaryTopic, i.difficulty_snapshot AS difficulty, i.practice_session_id AS sessionId,
    COUNT(r.id) AS responseCount, SUM(CASE WHEN r.status = 'submitted' THEN 1 ELSE 0 END) AS submittedResponseCount
    FROM mock_exam_items i LEFT JOIN practice_responses r ON r.session_id = i.practice_session_id
    WHERE i.exam_id IN (${placeholders}) GROUP BY i.id ORDER BY i.ordinal`).all(...ids) as Array<MockExamItem & { examId: string }>;
  return rows.map(row => ({ id: String(row.id), title: String(row.title), status: row.status as MockExamStatus, durationSeconds: Number(row.durationSeconds), questionCount: Number(row.questionCount), startedAt: row.startedAt ? String(row.startedAt) : undefined, submittedAt: row.submittedAt ? String(row.submittedAt) : undefined, createdAt: String(row.createdAt), updatedAt: String(row.updatedAt), items: items.filter(item => item.examId === row.id).map(({ examId: _examId, ...item }) => ({ ...item, responseCount: Number(item.responseCount ?? 0), submittedResponseCount: Number(item.submittedResponseCount ?? 0) })) }));
}

const mockExamSelect = `SELECT e.id, e.title, e.status, e.duration_seconds AS durationSeconds, e.started_at AS startedAt, e.submitted_at AS submittedAt, e.created_at AS createdAt, e.updated_at AS updatedAt, COUNT(i.id) AS questionCount FROM mock_exams e LEFT JOIN mock_exam_items i ON i.exam_id = e.id`;

export function listMockExams(app: App) {
  const db = getDatabase(app); const rows = db.prepare(`${mockExamSelect} GROUP BY e.id ORDER BY e.updated_at DESC LIMIT 50`).all() as Array<Record<string, unknown>>;
  return hydrateMockExams(db, rows);
}

export function getMockExam(app: App, examId: string) {
  const db = getDatabase(app); const row = db.prepare(`${mockExamSelect} WHERE e.id = ? GROUP BY e.id`).get(examId) as Record<string, unknown> | undefined;
  return row ? hydrateMockExams(db, [row])[0] : null;
}

export function createMockExam(app: App, input: CreateMockExamInput) {
  const db = getDatabase(app); const title = input.title.trim();
  if (!title || title.length > 160) throw new Error("模考试卷标题无效。");
  if (!Array.isArray(input.questionIds) || input.questionIds.length !== 10 || new Set(input.questionIds).size !== 10) throw new Error("全真欧几里得模考必须选择 10 道不同的已发布题目。");
  const rows = input.questionIds.map(questionId => db.prepare(`${questionBankSelect} WHERE b.id = ? AND b.status = 'published'`).get(questionId) as Record<string, unknown> | undefined);
  if (rows.some(row => !row)) throw new Error("模考题目中存在未发布或不存在的题目。");
  const questions = hydrateQuestionBank(db, rows as Array<Record<string, unknown>>); const now = new Date().toISOString(); const examId = crypto.randomUUID(); const durationSeconds = input.durationSeconds ?? 150 * 60;
  if (!Number.isInteger(durationSeconds) || durationSeconds < 60 || durationSeconds > 21600) throw new Error("模考时长无效。");
  const create = db.transaction(() => {
    db.prepare(`INSERT INTO mock_exams (id, title, status, duration_seconds, created_at, updated_at) VALUES (?, ?, 'draft', ?, ?, ?)`).run(examId, title, durationSeconds, now, now);
    const insertSession = db.prepare(`INSERT INTO practice_sessions (id, reference_key, title, status, started_at, updated_at) VALUES (@id, @referenceKey, @title, 'active', @now, @now)`);
    const insertItem = db.prepare(`INSERT INTO mock_exam_items (id, exam_id, question_id, practice_session_id, ordinal, maximum_points, title_snapshot, label_snapshot, prompt_snapshot, primary_topic_snapshot, difficulty_snapshot) VALUES (@id, @examId, @questionId, @sessionId, @ordinal, @maximumPoints, @title, @label, @promptText, @primaryTopic, @difficulty)`);
    questions.forEach((question, index) => { const sessionId = crypto.randomUUID(); insertSession.run({ id: sessionId, referenceKey: `mock:${examId}:q:${index + 1}`, title: `${title} · 第 ${index + 1} 题`, now }); insertItem.run({ id: crypto.randomUUID(), examId, questionId: question.id, sessionId, ordinal: index + 1, maximumPoints: question.maximumPoints ?? null, title: question.title, label: question.label, promptText: question.promptText, primaryTopic: question.primaryTopic, difficulty: question.difficulty ?? null }); });
  }); create(); return getMockExam(app, examId)!;
}

export function startMockExam(app: App, examId: string) {
  const db = getDatabase(app); const now = new Date().toISOString(); const result = db.prepare(`UPDATE mock_exams SET status = 'active', started_at = COALESCE(started_at, ?), updated_at = ? WHERE id = ? AND status IN ('draft', 'active')`).run(now, now, examId);
  if (result.changes !== 1) throw new Error("该模考无法开始，可能已经交卷或不存在。"); return getMockExam(app, examId)!;
}

export function submitMockExam(app: App, examId: string) {
  const db = getDatabase(app); const now = new Date().toISOString(); const submit = db.transaction(() => {
    const exam = db.prepare(`SELECT status FROM mock_exams WHERE id = ?`).get(examId) as { status: MockExamStatus } | undefined;
    if (!exam || !["draft", "active"].includes(exam.status)) throw new Error("该模考无法交卷，可能已经交卷或不存在。");
    db.prepare(`UPDATE mock_exams SET status = 'submitted', started_at = COALESCE(started_at, ?), submitted_at = ?, updated_at = ? WHERE id = ?`).run(now, now, now, examId);
    db.prepare(`UPDATE practice_sessions SET status = 'submitted', submitted_at = COALESCE(submitted_at, ?), updated_at = ? WHERE id IN (SELECT practice_session_id FROM mock_exam_items WHERE exam_id = ?)`).run(now, now, examId);
  }); submit(); return getMockExam(app, examId)!;
}

export function saveKnowledgeNode(app: App, input: SaveKnowledgeNodeInput) {
  const db = getDatabase(app); const now = new Date().toISOString(); const name = input.name.trim();
  if (!name || name.length > 100 || input.description.length > 1000) throw new Error("知识节点名称或说明无效。");
  const id = input.id ?? crypto.randomUUID(); db.prepare(`INSERT INTO knowledge_nodes (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, description = excluded.description, updated_at = excluded.updated_at`).run(id, name, input.description.trim(), now, now);
  return db.prepare(`SELECT id, name, description, created_at AS createdAt, updated_at AS updatedAt FROM knowledge_nodes WHERE id = ?`).get(id) as KnowledgeNode;
}

export function saveKnowledgeEdge(app: App, input: SaveKnowledgeEdgeInput) {
  const db = getDatabase(app); if (!input.prerequisiteNodeId || !input.dependentNodeId || input.prerequisiteNodeId === input.dependentNodeId || !Number.isFinite(input.strength) || input.strength <= 0 || input.strength > 1) throw new Error("知识依赖关系无效。");
  const id = input.id ?? crypto.randomUUID(); db.prepare(`INSERT INTO knowledge_edges (id, prerequisite_node_id, dependent_node_id, strength) VALUES (?, ?, ?, ?) ON CONFLICT(prerequisite_node_id, dependent_node_id) DO UPDATE SET strength = excluded.strength`).run(id, input.prerequisiteNodeId, input.dependentNodeId, input.strength);
  return db.prepare(`SELECT id, prerequisite_node_id AS prerequisiteNodeId, dependent_node_id AS dependentNodeId, strength FROM knowledge_edges WHERE prerequisite_node_id = ? AND dependent_node_id = ?`).get(input.prerequisiteNodeId, input.dependentNodeId) as KnowledgeEdge;
}

export function saveQuestionIrtParameter(app: App, input: SaveIrtItemParameterInput) {
  const db = getDatabase(app); const now = new Date().toISOString();
  if (!Number.isFinite(input.difficulty) || input.difficulty < -4 || input.difficulty > 4 || !Number.isFinite(input.discrimination) || input.discrimination <= 0 || input.discrimination > 4 || !Number.isFinite(input.guessing) || input.guessing < 0 || input.guessing >= .5 || !Array.isArray(input.nodeIds) || !input.nodeIds.length || input.nodeIds.length > 8) throw new Error("IRT 项目参数或知识映射无效。");
  const save = db.transaction(() => { const question = db.prepare(`SELECT id FROM question_bank WHERE id = ? AND status = 'published'`).get(input.questionId); if (!question) throw new Error("只能为已发布题目设置 IRT 参数。"); db.prepare(`INSERT INTO question_irt_parameters (question_id, difficulty, discrimination, guessing, source, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(question_id) DO UPDATE SET difficulty = excluded.difficulty, discrimination = excluded.discrimination, guessing = excluded.guessing, source = excluded.source, updated_at = excluded.updated_at`).run(input.questionId, input.difficulty, input.discrimination, input.guessing, input.source, now); db.prepare(`DELETE FROM question_knowledge_mappings WHERE question_id = ?`).run(input.questionId); const insert = db.prepare(`INSERT INTO question_knowledge_mappings (question_id, node_id, weight) VALUES (?, ?, ?)`); for (const nodeId of Array.from(new Set(input.nodeIds))) { if (!db.prepare(`SELECT id FROM knowledge_nodes WHERE id = ?`).get(nodeId)) throw new Error("题目映射了不存在的知识节点。"); insert.run(input.questionId, nodeId, 1); } }); save();
  return db.prepare(`SELECT question_id AS questionId, difficulty, discrimination, guessing, source, updated_at AS updatedAt FROM question_irt_parameters WHERE question_id = ?`).get(input.questionId) as IrtItemParameter;
}

function logistic(value: number) { return 1 / (1 + Math.exp(-Math.max(-35, Math.min(35, value)))); }
function questionParameter(question: QuestionBankQuestion, parameter?: IrtItemParameter): IrtItemParameter { return parameter ?? { questionId: question.id, difficulty: ((question.difficulty ?? 3) - 3) * .8, discrimination: 1, guessing: 0, source: "heuristic", updatedAt: question.updatedAt }; }
function predictedProbability(theta: number, parameter: IrtItemParameter) { return parameter.guessing + (1 - parameter.guessing) * logistic(1.7 * parameter.discrimination * (theta - parameter.difficulty)); }

export function getAdaptiveTrainingProfile(app: App): AdaptiveTrainingProfile {
  const db = getDatabase(app);
  const nodes = db.prepare(`SELECT id, name, description, created_at AS createdAt, updated_at AS updatedAt FROM knowledge_nodes ORDER BY name`).all() as KnowledgeNode[];
  const edges = db.prepare(`SELECT id, prerequisite_node_id AS prerequisiteNodeId, dependent_node_id AS dependentNodeId, strength FROM knowledge_edges ORDER BY dependent_node_id`).all() as KnowledgeEdge[];
  const mappings = db.prepare(`SELECT question_id AS questionId, node_id AS nodeId, weight FROM question_knowledge_mappings`).all() as QuestionKnowledgeMapping[];
  const storedParameters = db.prepare(`SELECT question_id AS questionId, difficulty, discrimination, guessing, source, updated_at AS updatedAt FROM question_irt_parameters`).all() as IrtItemParameter[];
  const questions = listQuestionBank(app, { limit: 500 }); const parameters = questions.map(question => questionParameter(question, storedParameters.find(parameter => parameter.questionId === question.id)));
  const evidence = db.prepare(`SELECT a.score_awarded * 1.0 / a.score_maximum AS scoreRate, m.node_id AS nodeId, m.weight, q.id AS questionId
    FROM assessment_records a JOIN practice_sessions s ON s.id = a.session_id
    LEFT JOIN mock_exam_items mi ON mi.practice_session_id = s.id
    LEFT JOIN question_bank q ON q.id = CASE WHEN mi.question_id IS NOT NULL THEN mi.question_id ELSE s.reference_key END
    JOIN question_knowledge_mappings m ON m.question_id = q.id
    WHERE a.status = 'confirmed'`).all() as Array<{ scoreRate: number; nodeId: string; weight: number; questionId: string }>;
  const abilityMap = new Map<string, AbilitySnapshot>();
  for (const node of nodes) {
    const samples = evidence.filter(item => item.nodeId === node.id); let theta = 0; let information = 1;
    for (const sample of samples) { const parameter = parameters.find(item => item.questionId === sample.questionId); if (!parameter) continue; const p = predictedProbability(theta, parameter); const derivative = (1 - parameter.guessing) * 1.7 * parameter.discrimination * logistic(1.7 * parameter.discrimination * (theta - parameter.difficulty)) * (1 - logistic(1.7 * parameter.discrimination * (theta - parameter.difficulty))); theta += Math.max(-.7, Math.min(.7, ((sample.scoreRate - p) * derivative / (derivative * derivative + .08)) * sample.weight)); information += sample.weight * derivative * derivative; }
    const snapshot = { nodeId: node.id, theta: Number(theta.toFixed(3)), standardError: Number((1 / Math.sqrt(information)).toFixed(3)), evidenceCount: samples.length, updatedAt: new Date().toISOString() }; abilityMap.set(node.id, snapshot);
  }
  const abilities = Array.from(abilityMap.values()); const persist = db.transaction(() => { const statement = db.prepare(`INSERT INTO learner_ability_snapshots (node_id, theta, standard_error, evidence_count, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(node_id) DO UPDATE SET theta = excluded.theta, standard_error = excluded.standard_error, evidence_count = excluded.evidence_count, updated_at = excluded.updated_at`); abilities.forEach(item => statement.run(item.nodeId, item.theta, item.standardError, item.evidenceCount, item.updatedAt)); }); persist();
  const recommendations: AdaptiveRecommendation[] = []; const used = new Set<string>(); const weakNodes = [...nodes].sort((left, right) => (abilityMap.get(left.id)?.theta ?? 0) - (abilityMap.get(right.id)?.theta ?? 0));
  for (const node of weakNodes.slice(0, 3)) {
    const target = abilityMap.get(node.id) ?? { theta: 0 }; const prerequisites = edges.filter(edge => edge.dependentNodeId === node.id).map(edge => edge.prerequisiteNodeId);
    const choose = (nodeId: string, reason: AdaptiveRecommendation["reason"], desired: number) => { const candidate = questions.filter(question => !used.has(question.id) && mappings.some(mapping => mapping.questionId === question.id && mapping.nodeId === nodeId)).map(question => ({ question, parameter: parameters.find(parameter => parameter.questionId === question.id)! })).sort((left, right) => Math.abs(predictedProbability(target.theta, left.parameter) - desired) - Math.abs(predictedProbability(target.theta, right.parameter) - desired))[0]; if (candidate) { used.add(candidate.question.id); recommendations.push({ question: candidate.question, reason, predictedProbability: Number(predictedProbability(target.theta, candidate.parameter).toFixed(3)), targetNodeId: nodeId, targetNodeName: nodes.find(item => item.id === nodeId)?.name ?? node.name }); } };
    const upstream = prerequisites.sort((left, right) => (abilityMap.get(left)?.theta ?? 0) - (abilityMap.get(right)?.theta ?? 0))[0]; if (upstream) choose(upstream, "upstream", .72); choose(node.id, "weakness", .62); choose(node.id, "stretch", .45);
  }
  const notice = nodes.length ? (evidence.length ? "能力估计仅使用已确认评分；项目参数未手工设置时使用题库难度生成的启发式初值。" : "尚无已确认评分：能力参数使用中性先验，推荐依据题库标签与知识依赖，不应视为个人能力结论。") : "请先建立知识节点、依赖关系并为题目配置 IRT 参数，才能生成可解释的自适应训练推荐。";
  return { nodes, edges, mappings, parameters, abilities, recommendations: recommendations.slice(0, 6), notice };
}

function parseTutorPlan(value: string): TutorPlan | undefined { try { const result = JSON.parse(value); return result && typeof result === "object" ? result as TutorPlan : undefined; } catch { return undefined; } }
export function getTutorSession(app: App, sessionId: string): TutorSession | null {
  const db = getDatabase(app); const row = db.prepare(`SELECT id, question_id AS questionId, provider_id AS providerId, status, question_text AS questionText, answer_text AS answerText, plan_json AS planJson, created_at AS createdAt, updated_at AS updatedAt FROM tutor_sessions WHERE id = ?`).get(sessionId) as (Omit<TutorSession, "plan" | "messages"> & { planJson: string }) | undefined;
  if (!row) return null; const messages = db.prepare(`SELECT id, role, content, created_at AS createdAt FROM tutor_messages WHERE tutor_session_id = ? ORDER BY created_at`).all(sessionId) as TutorSession["messages"]; return { ...row, plan: parseTutorPlan(row.planJson), messages };
}
export function createTutorSession(app: App, input: { questionId: string; providerId: string; questionText: string; answerText: string; }) {
  const db = getDatabase(app); const now = new Date().toISOString(); const id = crypto.randomUUID(); db.prepare(`INSERT INTO tutor_sessions (id, question_id, provider_id, status, question_text, answer_text, created_at, updated_at) VALUES (?, ?, ?, 'active', ?, ?, ?, ?)`).run(id, input.questionId, input.providerId, input.questionText.slice(0, 50_000), input.answerText.slice(0, 500_000), now, now); return getTutorSession(app, id)!;
}
export function saveTutorPlan(app: App, sessionId: string, plan: TutorPlan) { const db = getDatabase(app); const now = new Date().toISOString(); db.prepare(`UPDATE tutor_sessions SET plan_json = ?, updated_at = ? WHERE id = ?`).run(JSON.stringify(plan), now, sessionId); if (!db.prepare(`SELECT id FROM tutor_sessions WHERE id = ?`).get(sessionId)) throw new Error("互动讲解会话不存在。"); return getTutorSession(app, sessionId)!; }
export function appendTutorMessage(app: App, sessionId: string, role: "user" | "assistant", content: string) { const db = getDatabase(app); const now = new Date().toISOString(); if (!content.trim() || content.length > 20_000) throw new Error("互动讲解消息无效或超过保存限制。"); db.prepare(`INSERT INTO tutor_messages (id, tutor_session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)`).run(crypto.randomUUID(), sessionId, role, content.trim(), now); db.prepare(`UPDATE tutor_sessions SET updated_at = ? WHERE id = ?`).run(now, sessionId); return getTutorSession(app, sessionId)!; }

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
