import os from "node:os";
import path from "node:path";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { closeDatabase, getDatabase, savePracticeResponse } from "../dist/electron/database.js";
import { saveAiProvider } from "../dist/electron/ai-config.js";
import { prepareAiAssessment, runAuthorizedAiAssessment, testAiProvider } from "../dist/electron/ai-runtime.js";

const root = await mkdtemp(path.join(os.tmpdir(), "my-euclid-ai-runtime-"));
const app = { getPath: (name) => name === "userData" ? path.join(root, "user-data") : path.join(root, "temp") };
const secret = "sk-my-euclid-runtime-test-secret";
const storage = { isEncryptionAvailable: () => true, encryptString: value => Buffer.from(`encrypted:${Buffer.from(value).toString("base64url")}`), decryptString: value => Buffer.from(value.toString("utf8").replace(/^encrypted:/, ""), "base64url").toString("utf8") };
const originalFetch = globalThis.fetch;
let chatCalls = 0;
let forceInvalid = false;
globalThis.fetch = async (url, init = {}) => {
  const target = String(url);
  if (init.headers?.Authorization !== `Bearer ${secret}`) return new Response("unauthorized", { status: 401 });
  if (target.endsWith("/models")) return Response.json({ data: [{ id: "euclid-judge-test" }, { id: "euclid-fast-test" }] });
  if (target.endsWith("/chat/completions")) {
    chatCalls += 1;
    const body = JSON.parse(String(init.body));
    if (body.model !== "euclid-judge-test" || !String(body.messages?.[1]?.content).includes("证明 n 为偶数") || !String(body.messages?.[1]?.content).includes("令 n=2k")) return new Response("bad request body", { status: 400 });
    const content = forceInvalid ? JSON.stringify({ score_awarded: 10 }) : JSON.stringify({ score_awarded: 7, score_maximum: 10, summary: "主要论证成立，但收尾不完整。", overall_feedback: "补足整除定义与结论闭合。", evidence: [{ criterion: "写出 n=2k", maximum_points: 4, awarded_points: 4, rationale: "正确使用偶数定义。", response_quote: "令 n=2k" }, { criterion: "完成整除证明", maximum_points: 6, awarded_points: 3, rationale: "缺少最后一步。", response_quote: "所以成立" }], mistakes: [{ category: "completeness", severity: "moderate", module: "证明", note: "结论闭合不足。" }], modules: [{ module: "证明", maximum_points: 10, awarded_points: 7, note: "定义与推导。" }] });
    return Response.json({ choices: [{ message: { content } }] });
  }
  return new Response("not found", { status: 404 });
};

try {
  await mkdir(app.getPath("userData"), { recursive: true });
  getDatabase(app);
  const registry = await saveAiProvider(app, storage, { providerLabel: "Local mock", baseUrl: "https://mock.example/v1", model: "euclid-judge-test", apiKey: secret, enabled: true }, "darwin");
  const provider = registry.providers[0];
  const connection = await testAiProvider(app, storage, provider.id, "darwin");
  if (!connection.ok || connection.models.join(",") !== "euclid-judge-test,euclid-fast-test" || JSON.stringify(connection).includes(secret)) throw new Error("Model discovery leaked secrets or returned unexpected models.");
  const session = savePracticeResponse(app, { referenceKey: "E-TEST-01", title: "偶数证明", answerFormat: "keyboard", content: "令 n=2k，因此 n 为偶数。所以成立。", status: "submitted" });
  const response = session.responses[0];
  await runAuthorizedAiAssessment(app, storage, "00000000-0000-4000-8000-000000000000", "darwin").then(() => { throw new Error("Unauthorized AI run was unexpectedly accepted."); }).catch(error => { if (!String(error.message).includes("不存在或已被使用")) throw error; });
  const preview = await prepareAiAssessment(app, storage, { sessionId: session.id, responseId: response.id, questionText: "证明 n 为偶数。", scoreMaximum: 10 }, "darwin");
  if (preview.answerText !== response.content || preview.attachments.length || JSON.stringify(preview).includes(secret)) throw new Error("Authorization preview did not accurately disclose the send scope.");
  const result = await runAuthorizedAiAssessment(app, storage, preview.authorizationToken, "darwin");
  if (result.assessment.origin !== "ai" || result.assessment.status !== "draft" || result.assessment.scoreAwarded !== 7 || result.assessment.evidence.length !== 2 || chatCalls !== 1) throw new Error("Structured AI assessment draft was not saved correctly.");
  const db = getDatabase(app);
  const audit = db.prepare("SELECT status, action, response_excerpt AS responseExcerpt FROM ai_run_audits WHERE id = ?").get(result.auditId);
  if (audit?.status !== "succeeded" || audit?.action !== "assessment" || String(audit.responseExcerpt).includes(secret)) throw new Error("AI audit did not record the successful run safely.");
  forceInvalid = true;
  const invalidPreview = await prepareAiAssessment(app, storage, { sessionId: session.id, responseId: response.id, questionText: "证明 n 为偶数。", scoreMaximum: 10 }, "darwin");
  await runAuthorizedAiAssessment(app, storage, invalidPreview.authorizationToken, "darwin").then(() => { throw new Error("Invalid structured response was unexpectedly saved."); }).catch(error => { if (!/评分 JSON|评分草案/.test(String(error.message))) throw error; });
  const failedAudit = db.prepare("SELECT status FROM ai_run_audits WHERE action = 'assessment' ORDER BY authorized_at DESC LIMIT 1").get();
  if (failedAudit?.status !== "failed") throw new Error("Malformed AI response did not produce a failed audit record.");
  console.log("AI runtime authorization, structured draft, and audit smoke test passed");
} finally {
  globalThis.fetch = originalFetch;
  closeDatabase();
  await rm(root, { recursive: true, force: true });
}
process.exit(0);
