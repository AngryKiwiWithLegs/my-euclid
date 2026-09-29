import os from "node:os";
import path from "node:path";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import {
  closeDatabase,
  getAdaptiveTrainingProfile,
  getDatabase,
  publishQuestionDrafts,
  saveAssessmentRecord,
  saveKnowledgeEdge,
  saveKnowledgeNode,
  saveQuestionIrtParameter,
} from "../dist/electron/database.js";
import { saveResponse } from "../dist/electron/practice.js";

const root = await mkdtemp(path.join(os.tmpdir(), "my-euclid-adaptive-"));
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
  const sourceId = uuid(501);
  const pageId = uuid(502);
  db.prepare(
    "INSERT INTO source_documents (id, original_name, source_kind, stored_name, sha256, mime_type, size_bytes, imported_at) VALUES (?, 'Adaptive fixture', 'source_document', 'fixture', ?, 'text/plain', 1, ?)"
  ).run(sourceId, "a".repeat(64), now);
  db.prepare(
    "INSERT INTO document_pages (id, source_document_id, page_number, ocr_text, created_at, ocr_status, review_status, updated_at) VALUES (?, ?, 1, 'Fixture page', ?, 'reviewed', 'confirmed', ?)"
  ).run(pageId, sourceId, now, now);
  const inputs = [];
  for (let index = 1; index <= 3; index += 1) {
    const draftId = uuid(510 + index);
    db.prepare(
      "INSERT INTO question_drafts (id, source_document_id, page_id, ordinal, label, title, prompt_text, review_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?)"
    ).run(
      draftId,
      sourceId,
      pageId,
      index,
      `第 ${index} 题`,
      `自适应题 ${index}`,
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
        primaryTopic: index === 1 ? "基础递推" : "不变量",
        secondaryTopics: [],
        difficulty: index + 2,
        questionType: "证明",
        methods: [],
        proofRequired: true,
        estimatedMinutes: 12,
        maximumPoints: 4,
        scoringNotes: "Fixture",
        priority: 1,
        tags: [],
        subquestions: [],
      },
    });
  }
  const questions = publishQuestionDrafts(app, sourceId, inputs);
  const base = saveKnowledgeNode(app, {
    name: "递推关系",
    description: "理解递推定义与基本变形",
  });
  const invariant = saveKnowledgeNode(app, {
    name: "不变量",
    description: "构造并证明不变量",
  });
  saveKnowledgeEdge(app, {
    prerequisiteNodeId: base.id,
    dependentNodeId: invariant.id,
    strength: 1,
  });
  saveQuestionIrtParameter(app, {
    questionId: questions[0].id,
    difficulty: -1,
    discrimination: 1.2,
    guessing: 0,
    source: "manual",
    nodeIds: [base.id],
  });
  saveQuestionIrtParameter(app, {
    questionId: questions[1].id,
    difficulty: 0.5,
    discrimination: 1.3,
    guessing: 0,
    source: "manual",
    nodeIds: [invariant.id],
  });
  saveQuestionIrtParameter(app, {
    questionId: questions[2].id,
    difficulty: 1.2,
    discrimination: 1.4,
    guessing: 0,
    source: "manual",
    nodeIds: [invariant.id],
  });
  const session = await saveResponse(app, {
    referenceKey: questions[1].id,
    title: "Adaptive evidence",
    answerFormat: "keyboard",
    content: "Incomplete invariant proof",
    status: "submitted",
  });
  const response = session.responses[0];
  saveAssessmentRecord(app, {
    sessionId: session.id,
    responseId: response.id,
    status: "confirmed",
    scoreAwarded: 1,
    scoreMaximum: 4,
    overallFeedback: "Need a complete invariant proof.",
    summary: "Low evidence for invariant.",
    evidence: [
      {
        criterion: "Construct invariant",
        maximumPoints: 4,
        awardedPoints: 1,
        rationale: "Construction incomplete",
        responseQuote: "Incomplete",
        ordinal: 1,
      },
    ],
    mistakes: [
      {
        category: "reasoning",
        module: "不变量",
        severity: "major",
        note: "Missing closure",
        ordinal: 1,
      },
    ],
    modules: [
      {
        module: "不变量",
        awardedPoints: 1,
        maximumPoints: 4,
        note: "Needs review",
        ordinal: 1,
      },
    ],
  });
  const profile = getAdaptiveTrainingProfile(app);
  const invariantAbility = profile.abilities.find(
    item => item.nodeId === invariant.id
  );
  if (
    !invariantAbility ||
    invariantAbility.evidenceCount !== 1 ||
    profile.nodes.length !== 2 ||
    profile.edges.length !== 1 ||
    profile.parameters.filter(item => item.source === "manual").length !== 3
  )
    throw new Error(
      "IRT profile did not retain nodes, parameters and confirmed evidence."
    );
  if (
    !profile.recommendations.length ||
    !profile.recommendations.every(item => item.question.status === "published")
  )
    throw new Error(
      "Adaptive recommendations were not generated from published mapped questions."
    );
  try {
    saveQuestionIrtParameter(app, {
      questionId: questions[0].id,
      difficulty: 10,
      discrimination: 1,
      guessing: 0,
      source: "manual",
      nodeIds: [base.id],
    });
    throw new Error("Invalid IRT difficulty was accepted.");
  } catch (error) {
    if (!String(error.message).includes("IRT 项目参数")) throw error;
  }
  console.log("Knowledge graph and IRT adaptive training smoke test passed");
} finally {
  closeDatabase();
  await rm(root, { recursive: true, force: true });
}
process.exit(0);
