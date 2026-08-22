import Database from "better-sqlite3";
import path from "node:path";
import type { App } from "electron";
import type { ArchiveHealth, ImportJobSummary } from "./types.js";

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
  if (currentVersion >= 1) return;
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
