import os from "node:os";
import path from "node:path";
import { closeDatabase, listImportJobs, listQuestionBank, listReviewDocuments } from "../dist/electron/database.js";

const userDataPath = process.env.MY_EUCLID_USER_DATA || path.join(os.homedir(), "Library", "Application Support", "My Euclid");
const app = {
  getPath(name) {
    if (name === "userData") return userDataPath;
    return path.join(os.tmpdir(), "my-euclid-inspection");
  },
};

let exitCode = 0;
try {
  const [imports, documents, questions] = [listImportJobs(app), listReviewDocuments(app), listQuestionBank(app, { limit: 500 })];
  const documentById = new Map(documents.map(document => [document.sourceDocumentId, document]));
  const questionCountBySource = new Map();
  for (const question of questions) questionCountBySource.set(question.sourceDocumentId, (questionCountBySource.get(question.sourceDocumentId) ?? 0) + 1);

  const summary = {
    userDataPath,
    totals: {
      archivedImports: imports.length,
      reviewDocuments: documents.length,
      publishedQuestions: questions.length,
    },
    imports: imports.map(job => {
      const document = documentById.get(job.sourceDocumentId);
      return {
        originalName: job.originalName,
        kind: job.kind,
        importedAt: job.createdAt,
        archiveStatus: job.status,
        pageCount: document?.pageCount ?? 0,
        reviewStatus: document?.reviewStatus ?? "not_available",
        publishedQuestionCount: questionCountBySource.get(job.sourceDocumentId) ?? 0,
      };
    }),
  };

  console.log(JSON.stringify(summary, null, 2));
} catch (error) {
  console.error("LOCAL_ARCHIVE_INSPECTION_FAILED");
  console.error(error instanceof Error ? error.message : String(error));
  exitCode = 1;
} finally {
  closeDatabase();
}

process.exit(exitCode);
