import os from "node:os";
import path from "node:path";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import {
  closeDatabase,
  createMockExam,
  getMockExam,
  getQuestionBankQuestion,
  getDatabase,
  publishQuestionDrafts,
  startMockExam,
  submitMockExam,
} from "../dist/electron/database.js";
import { saveResponse } from "../dist/electron/practice.js";

const root = await mkdtemp(path.join(os.tmpdir(), "my-euclid-mock-exam-"));
const app = {
  getPath: name =>
    name === "userData"
      ? path.join(root, "user-data")
      : path.join(root, "temp"),
};
const uuid = index =>
  `${String(index).padStart(8, "0")}-0000-4000-8000-${String(index).padStart(12, "0")}`;
const now = new Date().toISOString();
try {
  await mkdir(app.getPath("userData"), { recursive: true });
  const db = getDatabase(app);
  const sourceId = uuid(101);
  const pageId = uuid(102);
  db.prepare(
    "INSERT INTO source_documents (id, original_name, source_kind, stored_name, sha256, mime_type, size_bytes, imported_at) VALUES (?, 'Euclid fixture', 'source_document', 'fixture', ?, 'text/plain', 1, ?)"
  ).run(sourceId, "a".repeat(64), now);
  db.prepare(
    "INSERT INTO document_pages (id, source_document_id, page_number, ocr_text, created_at, ocr_status, review_status, updated_at) VALUES (?, ?, 1, 'Fixture page', ?, 'reviewed', 'confirmed', ?)"
  ).run(pageId, sourceId, now, now);
  const inputs = [];
  for (let index = 1; index <= 10; index += 1) {
    const draftId = uuid(200 + index);
    db.prepare(
      "INSERT INTO question_drafts (id, source_document_id, page_id, ordinal, label, title, prompt_text, review_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?)"
    ).run(
      draftId,
      sourceId,
      pageId,
      index,
      `第 ${index} 题`,
      `题目 ${index}`,
      `Prompt ${index}`,
      now,
      now
    );
    inputs.push({
      questionDraftId: draftId,
      metadata: {
        sourceName: "Euclid",
        competitionYear: 2025,
        questionNumber: index,
        primaryTopic: "数论",
        secondaryTopics: [],
        difficulty: index > 7 ? 4 : 3,
        questionType: "证明",
        methods: ["构造"],
        proofRequired: true,
        estimatedMinutes: 15,
        maximumPoints: 10,
        scoringNotes: "Fixture",
        priority: 1,
        tags: [],
        subquestions: [],
      },
    });
  }
  const questions = publishQuestionDrafts(app, sourceId, inputs);
  if (questions.length !== 10)
    throw new Error("Could not publish all mock exam questions.");
  const exam = createMockExam(app, {
    title: "Euclid 150-minute fixture",
    questionIds: questions.map(question => question.id),
  });
  if (
    exam.status !== "draft" ||
    exam.questionCount !== 10 ||
    exam.durationSeconds !== 9000 ||
    exam.items.length !== 10
  )
    throw new Error(
      "Mock exam did not enforce the official 10-question 150-minute shape."
    );
  const originalTitle = exam.items[0].title;
  db.prepare(
    "UPDATE question_drafts SET title = 'Changed source title' WHERE id = ?"
  ).run(questions[0].sourceQuestionDraftId);
  if (getMockExam(app, exam.id)?.items[0].title !== originalTitle)
    throw new Error(
      "Mock exam item was not preserved as an immutable snapshot."
    );
  const started = startMockExam(app, exam.id);
  if (started.status !== "active" || !started.startedAt)
    throw new Error("Mock exam did not start locally.");
  const first = started.items[0];
  await saveResponse(app, {
    sessionId: first.sessionId,
    referenceKey: `mock:${exam.id}:q:1`,
    title: `${exam.title} · 第 1 题`,
    answerFormat: "keyboard",
    content: "A complete answer",
    status: "submitted",
  });
  const submitted = submitMockExam(app, exam.id);
  if (
    submitted.status !== "submitted" ||
    !submitted.submittedAt ||
    submitted.items[0].submittedResponseCount !== 1
  )
    throw new Error(
      "Mock exam submission did not preserve per-question response evidence."
    );
  try {
    createMockExam(app, {
      title: "Invalid exam",
      questionIds: questions.slice(0, 9).map(question => question.id),
    });
    throw new Error("Invalid question count was accepted.");
  } catch (error) {
    if (!String(error.message).includes("10 道不同")) throw error;
  }
  if (!getQuestionBankQuestion(app, questions[0].id))
    throw new Error(
      "Mock exam flow unexpectedly altered the source question bank."
    );
  console.log("Full mock exam flow smoke test passed");
} finally {
  closeDatabase();
  await rm(root, { recursive: true, force: true });
}
process.exit(0);
