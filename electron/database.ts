import Database from "better-sqlite3";
import path from "node:path";
import type { App } from "electron";
import type { ArchiveHealth, ImportJobSummary, QuestionDraft, ReviewDocumentDetail, ReviewDocumentSummary, ReviewPage } from "./types.js";

let database: Database.Database | null = null;

export function getDatabase(app: App) {
  if (database) return database;
  const databasePath = path.join(app.getPath("userData"), "my-euclid.sqlite");
  database = new Database(databasePath);
  database.pragma("foreign_keys = ON");
  migrate(database);
  return database;
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
  const pages = db.prepare(`SELECT id, page_number AS pageNumber, COALESCE(ocr_text, '') AS ocrText, ocr_status AS ocrStatus, review_status AS reviewStatus FROM document_pages WHERE source_document_id = ? ORDER BY page_number`).all(sourceDocumentId) as ReviewPage[];
  const questions = db.prepare(`SELECT id, page_id AS pageId, label, title, prompt_text AS promptText, ordinal FROM question_drafts WHERE source_document_id = ? ORDER BY ordinal`).all(sourceDocumentId) as QuestionDraft[];
  const subquestions = db.prepare(`SELECT id, question_draft_id AS questionId, label, prompt_text AS text, ordinal FROM subquestion_drafts WHERE question_draft_id IN (SELECT id FROM question_drafts WHERE source_document_id = ?) ORDER BY ordinal`).all(sourceDocumentId) as Array<{ id: string; questionId: string; label: string; text: string; ordinal: number }>;
  return { ...document, pages, questions: questions.map(question => ({ ...question, subquestions: subquestions.filter(sub => sub.questionId === question.id).map(({ questionId: _questionId, ...sub }) => sub) })) };
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
