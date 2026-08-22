import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { archiveFiles, getArchiveDirectory } from "../dist/electron/archive.js";
import { getReviewDocument, listImportJobs, listReviewDocuments, saveQuestionDrafts, updatePageOcr } from "../dist/electron/database.js";

const directory = mkdtempSync(path.join(tmpdir(), "my-euclid-archive-flow-"));
const sourcePath = path.join(directory, "euclid-note.txt");
const app = { getPath: () => directory };

try {
  writeFileSync(sourcePath, "Question 1. Prove that the sequence has an invariant. (a) Find it. (b) Prove it.", "utf8");
  const jobs = await archiveFiles(app, [sourcePath], "source_document");
  if (jobs.length !== 1 || jobs[0].status !== "needs_review") throw new Error("Import job was not created.");
  const storedPath = path.join(getArchiveDirectory(app), `${jobs[0].sourceDocumentId}.txt`);
  if (!existsSync(storedPath)) throw new Error("Original file was not copied into the archive.");
  const listed = listImportJobs(app);
  if (listed.length !== 1 || listed[0].originalName !== "euclid-note.txt") throw new Error("Import job was not persisted.");
  const reviewDocuments = listReviewDocuments(app);
  if (reviewDocuments.length !== 1 || reviewDocuments[0].pageCount !== 1) throw new Error("Review document page record was not created.");
  const detail = getReviewDocument(app, jobs[0].sourceDocumentId);
  if (!detail?.pages[0]?.ocrText.includes("Question 1")) throw new Error("Text extraction was not persisted on the review page.");
  updatePageOcr(app, detail.pages[0].id, "Question 1. Prove the invariant. (a) Find it. (b) Justify it.");
  saveQuestionDrafts(app, jobs[0].sourceDocumentId, [{
    pageId: detail.pages[0].id,
    label: "第 1 题",
    title: "递推不变量",
    promptText: "Prove the invariant.",
    ordinal: 1,
    subquestions: [{ label: "(a)", text: "Find it.", ordinal: 1 }, { label: "(b)", text: "Justify it.", ordinal: 2 }],
  }]);
  const confirmed = getReviewDocument(app, jobs[0].sourceDocumentId);
  if (confirmed?.questions.length !== 1 || confirmed.questions[0].subquestions.length !== 2 || confirmed.pages[0].reviewStatus !== "confirmed") throw new Error("Review confirmation was not persisted.");
  console.log("Archive flow smoke test passed");
} finally {
  rmSync(directory, { recursive: true, force: true });
}
process.exit(0);
