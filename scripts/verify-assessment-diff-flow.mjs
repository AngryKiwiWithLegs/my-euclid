import os from "node:os";
import path from "node:path";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import {
  closeDatabase,
  getAssessmentDashboard,
  getAssessmentRecord,
  listAssessmentRecords,
  saveAiAssessmentDraft,
  saveAssessmentRecord,
} from "../dist/electron/database.js";
import { saveResponse } from "../dist/electron/practice.js";

const root = await mkdtemp(
  path.join(os.tmpdir(), "my-euclid-assessment-diff-")
);
const app = {
  getPath: name =>
    name === "userData"
      ? path.join(root, "user-data")
      : path.join(root, "temp"),
};
try {
  await mkdir(app.getPath("userData"), { recursive: true });
  const session = await saveResponse(app, {
    referenceKey: "E-DIFF-01",
    title: "比例证明差异审核",
    answerFormat: "keyboard",
    content: "由角平分线定理得到比例，故结论成立。",
    status: "submitted",
  });
  const response = session.responses[0];
  const ai = saveAiAssessmentDraft(app, {
    sessionId: session.id,
    responseId: response.id,
    status: "draft",
    scoreAwarded: 6,
    scoreMaximum: 10,
    summary: "AI 草案",
    overallFeedback: "补足比例变形。",
    evidence: [
      {
        criterion: "列出比例",
        maximumPoints: 4,
        awardedPoints: 4,
        rationale: "比例正确。",
        responseQuote: "由角平分线定理得到比例",
        ordinal: 1,
      },
      {
        criterion: "完成变形",
        maximumPoints: 6,
        awardedPoints: 2,
        rationale: "步骤省略。",
        responseQuote: "故结论成立",
        ordinal: 2,
      },
    ],
    mistakes: [
      {
        category: "completeness",
        module: "几何",
        severity: "moderate",
        note: "缺少中间变形。",
        ordinal: 1,
      },
    ],
    modules: [
      {
        module: "几何",
        maximumPoints: 10,
        awardedPoints: 6,
        note: "AI 草案。",
        ordinal: 1,
      },
    ],
  });
  const manual = saveAssessmentRecord(app, {
    sessionId: session.id,
    responseId: response.id,
    status: "confirmed",
    scoreAwarded: 8,
    scoreMaximum: 10,
    summary: "人工确认",
    overallFeedback: "比例与结论均可接受。",
    evidence: [
      {
        criterion: "列出比例",
        maximumPoints: 4,
        awardedPoints: 4,
        rationale: "比例正确。",
        responseQuote: "由角平分线定理得到比例",
        ordinal: 1,
      },
      {
        criterion: "完成变形",
        maximumPoints: 6,
        awardedPoints: 4,
        rationale: "省略一行但推理充分。",
        responseQuote: "故结论成立",
        ordinal: 2,
      },
    ],
    mistakes: [
      {
        category: "communication",
        module: "几何",
        severity: "minor",
        note: "书写可更完整。",
        ordinal: 1,
      },
    ],
    modules: [
      {
        module: "几何",
        maximumPoints: 10,
        awardedPoints: 8,
        note: "人工确认。",
        ordinal: 1,
      },
    ],
  });
  const pair = listAssessmentRecords(app).filter(
    item => item.responseId === response.id
  );
  if (
    pair.length !== 2 ||
    !pair.some(
      item =>
        item.id === ai.id && item.origin === "ai" && item.status === "draft"
    ) ||
    !pair.some(
      item =>
        item.id === manual.id &&
        item.origin === "manual" &&
        item.status === "confirmed"
    )
  )
    throw new Error(
      "AI draft and manual assessment were not retained as a comparable pair."
    );
  const aiDetail = getAssessmentRecord(app, ai.id);
  const manualDetail = getAssessmentRecord(app, manual.id);
  if (
    !aiDetail ||
    !manualDetail ||
    aiDetail.evidence.length !== 2 ||
    manualDetail.evidence.length !== 2 ||
    manualDetail.evidence[1].awardedPoints -
      aiDetail.evidence[1].awardedPoints !==
      2 ||
    manualDetail.evidence[1].responseQuote !==
      aiDetail.evidence[1].responseQuote
  )
    throw new Error(
      "Per-evidence score delta or quoted response evidence was not preserved."
    );
  const dashboard = getAssessmentDashboard(app);
  if (
    dashboard.assessmentCount !== 2 ||
    dashboard.confirmedCount !== 1 ||
    dashboard.weightedScoreRate !== 0.8 ||
    dashboard.history.length !== 1 ||
    dashboard.history[0].assessmentId !== manual.id
  )
    throw new Error(
      "AI draft was incorrectly included in confirmed reporting."
    );
  console.log(
    "AI/manual assessment diff and confirmed-report isolation smoke test passed"
  );
} finally {
  closeDatabase();
  await rm(root, { recursive: true, force: true });
}
process.exit(0);
