import os from "node:os";
import path from "node:path";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import {
  exportBackup,
  preflightBackup,
  restoreBackup,
} from "../dist/electron/backup.js";
import {
  closeDatabase,
  getAssessmentDashboard,
  getAssessmentRecord,
  saveAssessmentRecord,
} from "../dist/electron/database.js";
import { saveResponse } from "../dist/electron/practice.js";

const root = await mkdtemp(
  path.join(os.tmpdir(), "my-euclid-assessment-report-")
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
    referenceKey: "E-2025-07b",
    title: "Euclid 2025 · 第 7 题 (b)",
    answerFormat: "keyboard",
    content: "I propose an invariant and justify the induction step.",
    status: "submitted",
  });
  const response = session.responses[0];
  const saved = saveAssessmentRecord(app, {
    sessionId: session.id,
    responseId: response.id,
    status: "confirmed",
    scoreAwarded: 7,
    scoreMaximum: 10,
    summary: "不变量构造正确，但最终闭合论证不充分。",
    overallFeedback: "先显式写出归纳假设，再逐项验证递推不变量。",
    evidence: [
      {
        criterion: "识别并定义不变量",
        maximumPoints: 4,
        awardedPoints: 4,
        rationale: "不变量定义正确且与递推式匹配。",
        responseQuote: "Let I_n = ...",
        ordinal: 1,
      },
      {
        criterion: "完成证明闭合",
        maximumPoints: 6,
        awardedPoints: 3,
        rationale: "归纳步方向正确，但没有明确回代初始条件。",
        responseQuote: "Therefore it remains constant.",
        ordinal: 2,
      },
    ],
    mistakes: [
      {
        category: "completeness",
        module: "数列与递推",
        severity: "moderate",
        note: "证明缺少由归纳假设回到初始条件的闭合步骤。",
        ordinal: 1,
      },
    ],
    modules: [
      {
        module: "数列与递推",
        awardedPoints: 7,
        maximumPoints: 10,
        note: "不变量识别良好，证明完整性待加强。",
        ordinal: 1,
      },
    ],
  });
  if (
    saved.evidence.length !== 2 ||
    saved.mistakes.length !== 1 ||
    saved.modules.length !== 1
  )
    throw new Error(
      "Assessment evidence, mistake, or module records were not persisted."
    );
  const detail = getAssessmentRecord(app, saved.id);
  if (
    !detail?.confirmedAt ||
    detail.scoreAwarded !== 7 ||
    detail.responseId !== response.id
  )
    throw new Error("Assessment record did not retain response provenance.");
  const dashboard = getAssessmentDashboard(app);
  if (
    dashboard.confirmedCount !== 1 ||
    dashboard.weightedScoreRate !== 0.7 ||
    dashboard.modules[0]?.module !== "数列与递推" ||
    dashboard.mistakes[0]?.category !== "completeness"
  )
    throw new Error("Assessment dashboard aggregation is incorrect.");

  const backupPath = path.join(root, "assessment-report.myeuclid-backup.zip");
  await exportBackup(app, backupPath);
  saveAssessmentRecord(app, {
    sessionId: session.id,
    responseId: response.id,
    status: "draft",
    scoreAwarded: 0,
    scoreMaximum: 1,
    summary: "later draft",
    overallFeedback: "",
    evidence: [],
    mistakes: [],
    modules: [],
  });
  if (getAssessmentDashboard(app).assessmentCount !== 2)
    throw new Error("Post-backup assessment mutation did not persist.");
  const selection = await preflightBackup(app, backupPath);
  await restoreBackup(app, selection.token);
  const restored = getAssessmentDashboard(app);
  if (
    restored.assessmentCount !== 1 ||
    restored.confirmedCount !== 1 ||
    restored.weightedScoreRate !== 0.7
  )
    throw new Error(
      "Backup restore did not recover assessment and report data."
    );
  console.log("Assessment report and backup smoke test passed");
} finally {
  closeDatabase();
  await rm(root, { recursive: true, force: true });
}
process.exit(0);
