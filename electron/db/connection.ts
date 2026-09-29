import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { App } from "electron";

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

export function getDatabasePath(app: App) {
  return path.join(app.getPath("userData"), "my-euclid.sqlite");
}

export function closeDatabase() {
  database?.close();
  database = null;
}

export function checkpointDatabase(app: App) {
  getDatabase(app).pragma("wal_checkpoint(TRUNCATE)");
}

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
