import os from "node:os";
import path from "node:path";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import {
  closeDatabase,
  getDatabase,
  getQuestionBankQuestion,
  listQuestionBank,
  publishQuestionDrafts,
  saveQuestionDrafts,
} from "../dist/electron/database.js";

const root = await mkdtemp(path.join(os.tmpdir(), "my-euclid-question-bank-"));
const app = {
  getPath: name =>
    name === "userData"
      ? path.join(root, "user-data")
      : path.join(root, "temp"),
};
const now = new Date().toISOString();
try {
  await mkdir(app.getPath("userData"), { recursive: true });
  const db = getDatabase(app);
  const sourceId = "11111111-1111-4111-8111-111111111111";
  const pageId = "22222222-2222-4222-8222-222222222222";
  const draftId = "33333333-3333-4333-8333-333333333333";
  const subId = "44444444-4444-4444-8444-444444444444";
  db.prepare(
    "INSERT INTO source_documents (id, original_name, source_kind, stored_name, sha256, mime_type, size_bytes, imported_at) VALUES (?, ?, 'source_document', ?, ?, 'text/plain', 1, ?)"
  ).run(sourceId, "Euclid 2025.txt", "fixture.txt", "a".repeat(64), now);
  db.prepare(
    "INSERT INTO document_pages (id, source_document_id, page_number, ocr_text, created_at, ocr_status, review_status, updated_at) VALUES (?, ?, 1, ?, ?, 'reviewed', 'confirmed', ?)"
  ).run(pageId, sourceId, "Prove the statement.", now, now);
  db.prepare(
    "INSERT INTO question_drafts (id, source_document_id, page_id, ordinal, label, title, prompt_text, review_status, created_at, updated_at) VALUES (?, ?, ?, 7, '第 7 题', '递推中的不变量', ?, 'confirmed', ?, ?)"
  ).run(draftId, sourceId, pageId, "Prove the sequence invariant.", now, now);
  db.prepare(
    "INSERT INTO subquestion_drafts (id, question_draft_id, ordinal, label, prompt_text, review_status, created_at, updated_at) VALUES (?, ?, 1, '(a)', ?, 'confirmed', ?, ?)"
  ).run(subId, draftId, "Establish the invariant.", now, now);
  const metadata = {
    sourceName: "Euclid",
    competitionYear: 2025,
    questionNumber: 7,
    primaryTopic: "数列与递推",
    secondaryTopics: ["不变量"],
    difficulty: 4,
    questionType: "证明",
    methods: ["构造"],
    proofRequired: true,
    estimatedMinutes: 12,
    maximumPoints: 4,
    scoringNotes: "需证明归纳闭合。",
    priority: 3,
    tags: [
      { category: "来源", value: "Euclid" },
      { category: "状态", value: "重点" },
    ],
    subquestions: [
      {
        sourceSubquestionDraftId: subId,
        ordinal: 1,
        label: "(a)",
        promptText: "Establish the invariant.",
        maximumPoints: 4,
      },
    ],
  };
  const published = publishQuestionDrafts(app, sourceId, [
    { questionDraftId: draftId, metadata },
  ]);
  if (
    published.length !== 1 ||
    published[0].sourceQuestionDraftId !== draftId ||
    published[0].subquestions.length !== 1 ||
    published[0].tags.length !== 2 ||
    published[0].pageNumber !== 1 ||
    published[0].proofRequired !== true
  )
    throw new Error(
      "Question publication did not preserve required source evidence or metadata."
    );
  saveQuestionDrafts(app, sourceId, [
    {
      id: draftId,
      pageId,
      ordinal: 7,
      label: "第 7 题",
      title: "递推中的不变量（修订）",
      promptText: "Prove the updated sequence invariant.",
      subquestions: [
        {
          id: subId,
          ordinal: 1,
          label: "(a)",
          text: "Establish the updated invariant.",
        },
      ],
    },
  ]);
  const retainedAfterResave = getQuestionBankQuestion(app, published[0].id);
  if (
    !retainedAfterResave ||
    retainedAfterResave.title !== "递推中的不变量（修订）" ||
    retainedAfterResave.subquestions[0]?.sourceSubquestionDraftId !== subId
  )
    throw new Error(
      "Resaving a published question draft broke its question-bank traceability."
    );
  const found = listQuestionBank(app, {
    query: "递推",
    primaryTopic: "数列与递推",
  });
  if (
    found.length !== 1 ||
    found[0].difficulty !== 4 ||
    found[0].methods[0] !== "构造"
  )
    throw new Error("Question bank search did not return published metadata.");
  const updated = publishQuestionDrafts(app, sourceId, [
    {
      questionDraftId: draftId,
      metadata: {
        ...metadata,
        difficulty: 5,
        tags: [
          { category: "来源", value: "Euclid" },
          { category: "优先级", value: "冲刺" },
        ],
      },
    },
  ]);
  if (
    updated[0].difficulty !== 5 ||
    updated[0].tags.some(tag => tag.value === "重点")
  )
    throw new Error("Republishing did not update metadata atomically.");
  const detail = getQuestionBankQuestion(app, updated[0].id);
  if (
    !detail ||
    detail.sourceDocumentId !== sourceId ||
    detail.subquestions[0].sourceSubquestionDraftId !== subId
  )
    throw new Error("Question detail lost its audit links.");
  try {
    publishQuestionDrafts(app, sourceId, [
      {
        questionDraftId: draftId,
        metadata: {
          ...metadata,
          sourceName: "",
          primaryTopic: "",
          questionType: "",
        },
      },
    ]);
    throw new Error("Incomplete publishing metadata was accepted.");
  } catch (error) {
    if (!String(error.message).includes("来源、主考点和题型")) throw error;
  }
  console.log("Question bank publication and traceability smoke test passed");
} finally {
  closeDatabase();
  await rm(root, { recursive: true, force: true });
}
process.exit(0);
