import { randomUUID } from "node:crypto";
import type { App } from "electron";
import { getDatabase } from "./connection.js";
import type {
  ArchiveHealth,
  ImportJobSummary,
  NormalizedRect,
  OcrRegion,
  QuestionDraft,
  ReviewDocumentDetail,
  ReviewDocumentSummary,
  ReviewPage,
} from "../types.js";

export function listImportJobs(app: App): ImportJobSummary[] {
  const db = getDatabase(app);
  const rows = db
    .prepare(
      `
    SELECT j.id, j.source_document_id AS sourceDocumentId, d.original_name AS originalName,
           d.source_kind AS kind, j.status, j.created_at AS createdAt, j.error_message AS errorMessage
    FROM import_jobs j
    JOIN source_documents d ON d.id = j.source_document_id
    ORDER BY j.created_at DESC
    LIMIT 30
  `
    )
    .all() as ImportJobSummary[];
  return rows;
}

export function databaseHealth(app: App, archiveReady: boolean): ArchiveHealth {
  const db = getDatabase(app);
  const documentCount = (
    db.prepare("SELECT COUNT(*) AS count FROM source_documents").get() as {
      count: number;
    }
  ).count;
  const pendingReviewCount = (
    db
      .prepare(
        "SELECT COUNT(*) AS count FROM import_jobs WHERE status = 'needs_review'"
      )
      .get() as { count: number }
  ).count;
  return {
    mode: "desktop",
    databaseReady: true,
    archiveReady,
    documentCount,
    pendingReviewCount,
  };
}

export function createDocumentPages(
  app: App,
  sourceDocumentId: string,
  pages: Array<{
    pageNumber: number;
    ocrText: string;
    ocrStatus: "pending" | "extracted" | "failed";
  }>
) {
  const db = getDatabase(app);
  const now = new Date().toISOString();
  const insert =
    db.prepare(`INSERT INTO document_pages (id, source_document_id, page_number, ocr_text, ocr_status, review_status, created_at, updated_at)
    VALUES (@id, @sourceDocumentId, @pageNumber, @ocrText, @ocrStatus, 'needs_review', @now, @now)`);
  const create = db.transaction(() => {
    for (const page of pages)
      insert.run({ id: randomUUID(), sourceDocumentId, ...page, now });
  });
  create();
}

export function listReviewDocuments(app: App): ReviewDocumentSummary[] {
  const db = getDatabase(app);
  return db
    .prepare(
      `
    SELECT d.id AS sourceDocumentId, d.original_name AS originalName, d.source_kind AS kind, d.imported_at AS importedAt,
      COUNT(p.id) AS pageCount,
      CASE WHEN SUM(CASE WHEN p.review_status = 'needs_review' THEN 1 ELSE 0 END) > 0 THEN 'needs_review' ELSE 'confirmed' END AS reviewStatus
    FROM source_documents d
    LEFT JOIN document_pages p ON p.source_document_id = d.id
    GROUP BY d.id
    ORDER BY d.imported_at DESC
  `
    )
    .all() as ReviewDocumentSummary[];
}

export function getReviewDocument(
  app: App,
  sourceDocumentId: string
): ReviewDocumentDetail | null {
  const db = getDatabase(app);
  const document = db
    .prepare(
      `
    SELECT d.id AS sourceDocumentId, d.original_name AS originalName, d.source_kind AS kind, d.imported_at AS importedAt,
      COUNT(p.id) AS pageCount,
      CASE WHEN SUM(CASE WHEN p.review_status = 'needs_review' THEN 1 ELSE 0 END) > 0 THEN 'needs_review' ELSE 'confirmed' END AS reviewStatus
    FROM source_documents d LEFT JOIN document_pages p ON p.source_document_id = d.id
    WHERE d.id = ? GROUP BY d.id
  `
    )
    .get(sourceDocumentId) as ReviewDocumentSummary | undefined;
  if (!document) return null;
  const pageRows = db
    .prepare(
      `SELECT id, page_number AS pageNumber, COALESCE(ocr_text, '') AS ocrText, ocr_status AS ocrStatus, review_status AS reviewStatus FROM document_pages WHERE source_document_id = ? ORDER BY page_number`
    )
    .all(sourceDocumentId) as Array<Omit<ReviewPage, "regions">>;
  const regions = db
    .prepare(
      `SELECT id, page_id AS pageId, x, y, width, height, ocr_text AS ocrText, ocr_status AS ocrStatus, created_at AS createdAt FROM ocr_region_runs WHERE page_id IN (SELECT id FROM document_pages WHERE source_document_id = ?) ORDER BY created_at DESC`
    )
    .all(sourceDocumentId) as Array<{
    id: string;
    pageId: string;
    x: number;
    y: number;
    width: number;
    height: number;
    ocrText: string;
    ocrStatus: OcrRegion["ocrStatus"];
    createdAt: string;
  }>;
  const pages: ReviewPage[] = pageRows.map(page => ({
    ...page,
    regions: regions
      .filter(region => region.pageId === page.id)
      .map(({ x, y, width, height, ...region }) => ({
        ...region,
        rect: { x, y, width, height },
      })),
  }));
  const questions = db
    .prepare(
      `SELECT id, page_id AS pageId, label, title, prompt_text AS promptText, ordinal FROM question_drafts WHERE source_document_id = ? ORDER BY ordinal`
    )
    .all(sourceDocumentId) as QuestionDraft[];
  const subquestions = db
    .prepare(
      `SELECT id, question_draft_id AS questionId, label, prompt_text AS text, ordinal FROM subquestion_drafts WHERE question_draft_id IN (SELECT id FROM question_drafts WHERE source_document_id = ?) ORDER BY ordinal`
    )
    .all(sourceDocumentId) as Array<{
    id: string;
    questionId: string;
    label: string;
    text: string;
    ordinal: number;
  }>;
  return {
    ...document,
    pages,
    questions: questions.map(question => ({
      ...question,
      subquestions: subquestions
        .filter(sub => sub.questionId === question.id)
        .map(({ questionId: _questionId, ...sub }) => sub),
    })),
  };
}

export function getReviewPageSource(app: App, pageId: string) {
  const db = getDatabase(app);
  return db
    .prepare(
      `SELECT p.id AS pageId, p.page_number AS pageNumber, d.stored_name AS storedName, d.mime_type AS mimeType, d.original_name AS originalName
    FROM document_pages p JOIN source_documents d ON d.id = p.source_document_id WHERE p.id = ?`
    )
    .get(pageId) as
    | {
        pageId: string;
        pageNumber: number;
        storedName: string;
        mimeType: string;
        originalName: string;
      }
    | undefined;
}

export function saveOcrRegionRun(
  app: App,
  input: {
    pageId: string;
    rect: NormalizedRect;
    sourceWidth: number;
    sourceHeight: number;
    cropSha256: string;
    cropPreviewDataUrl: string;
    ocrText: string;
    ocrStatus: OcrRegion["ocrStatus"];
  }
): OcrRegion {
  const db = getDatabase(app);
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO ocr_region_runs (id, page_id, x, y, width, height, source_width, source_height, crop_sha256, crop_preview_data_url, ocr_text, ocr_status, created_at)
    VALUES (@id, @pageId, @x, @y, @width, @height, @sourceWidth, @sourceHeight, @cropSha256, @cropPreviewDataUrl, @ocrText, @ocrStatus, @createdAt)`
  ).run({
    id,
    pageId: input.pageId,
    ...input.rect,
    sourceWidth: input.sourceWidth,
    sourceHeight: input.sourceHeight,
    cropSha256: input.cropSha256,
    cropPreviewDataUrl: input.cropPreviewDataUrl,
    ocrText: input.ocrText.slice(0, 250_000),
    ocrStatus: input.ocrStatus,
    createdAt,
  });
  return {
    id,
    pageId: input.pageId,
    rect: input.rect,
    ocrText: input.ocrText.slice(0, 250_000),
    ocrStatus: input.ocrStatus,
    createdAt,
  };
}

export function updatePageOcr(app: App, pageId: string, ocrText: string) {
  const db = getDatabase(app);
  const result = db
    .prepare(
      `UPDATE document_pages SET ocr_text = ?, ocr_status = 'reviewed', review_status = 'confirmed', updated_at = ? WHERE id = ?`
    )
    .run(ocrText, new Date().toISOString(), pageId);
  if (result.changes !== 1) throw new Error("未找到需要更新的页面。");
}

export function saveQuestionDrafts(
  app: App,
  sourceDocumentId: string,
  questions: QuestionDraft[]
) {
  const db = getDatabase(app);
  const pageIds = new Set(
    db
      .prepare(`SELECT id FROM document_pages WHERE source_document_id = ?`)
      .all(sourceDocumentId)
      .map(row => String((row as { id: string }).id))
  );
  for (const question of questions)
    if (!pageIds.has(question.pageId))
      throw new Error("题目草案的来源页面不属于当前资料。");
  const now = new Date().toISOString();
  const save = db.transaction(() => {
    const questionInsert =
      db.prepare(`INSERT INTO question_drafts (id, source_document_id, page_id, ordinal, label, title, prompt_text, review_status, created_at, updated_at)
      VALUES (@id, @sourceDocumentId, @pageId, @ordinal, @label, @title, @promptText, 'confirmed', @now, @now)
      ON CONFLICT(id) DO UPDATE SET page_id = excluded.page_id, ordinal = excluded.ordinal, label = excluded.label, title = excluded.title, prompt_text = excluded.prompt_text, review_status = 'confirmed', updated_at = excluded.updated_at`);
    const subquestionInsert =
      db.prepare(`INSERT INTO subquestion_drafts (id, question_draft_id, ordinal, label, prompt_text, review_status, created_at, updated_at)
      VALUES (@id, @questionId, @ordinal, @label, @text, 'confirmed', @now, @now)
      ON CONFLICT(id) DO UPDATE SET question_draft_id = excluded.question_draft_id, ordinal = excluded.ordinal, label = excluded.label, prompt_text = excluded.prompt_text, review_status = 'confirmed', updated_at = excluded.updated_at`);
    questions.forEach(question => {
      const questionId = question.id ?? randomUUID();
      questionInsert.run({
        ...question,
        id: questionId,
        sourceDocumentId,
        now,
      });
      question.subquestions.forEach(subquestion =>
        subquestionInsert.run({
          ...subquestion,
          id: subquestion.id ?? randomUUID(),
          questionId,
          now,
        })
      );
    });
    db.prepare(
      `UPDATE import_jobs SET status = 'archived', updated_at = ? WHERE source_document_id = ?`
    ).run(now, sourceDocumentId);
  });
  save();
}
