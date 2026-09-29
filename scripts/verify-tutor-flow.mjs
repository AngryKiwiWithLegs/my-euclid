import os from "node:os";
import path from "node:path";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import {
  closeDatabase,
  getDatabase,
  getTutorSession,
  publishQuestionDrafts,
} from "../dist/electron/database.js";
import { saveAiProvider } from "../dist/electron/ai-config.js";
import {
  askTutorQuestion,
  prepareTutorSession,
  runAuthorizedTutorSession,
} from "../dist/electron/ai-runtime.js";

const root = await mkdtemp(path.join(os.tmpdir(), "my-euclid-tutor-"));
const app = {
  getPath: name =>
    name === "userData"
      ? path.join(root, "user-data")
      : path.join(root, "temp"),
};
const secret = "sk-my-euclid-tutor-test-secret";
const storage = {
  isEncryptionAvailable: () => true,
  encryptString: value =>
    Buffer.from(`encrypted:${Buffer.from(value).toString("base64url")}`),
  decryptString: value =>
    Buffer.from(
      value.toString("utf8").replace(/^encrypted:/, ""),
      "base64url"
    ).toString("utf8"),
};
const originalFetch = globalThis.fetch;
let forceInvalid = false;
let receivedQuestion = "";
const validPlan = {
  prerequisite_knowledge: ["相似三角形", "角平分线定理"],
  entry_point: "先找出角平分线与边长比例。",
  thought_source: "从角平分线自然联想到比例。",
  methods: [
    {
      name: "角平分线定理",
      outline: "由比例列式并化简。",
      key_idea: "角平分线给出相邻边比。",
      pitfalls: "不要忽略正长度。",
    },
    {
      name: "面积比",
      outline: "用公共高比较面积。",
      key_idea: "面积比转边长比。",
      pitfalls: "对应底边要一致。",
    },
    {
      name: "正弦定理",
      outline: "转化角与边的关系。",
      key_idea: "三角函数统一比例。",
      pitfalls: "角的对应关系。",
    },
  ],
  similar_type: "三角形比例构造题",
  variants: ["改变已知边长", "改为求面积比"],
  socratic_question: "哪一条比例能最先把未知边联系起来？",
};
globalThis.fetch = async (url, init = {}) => {
  if (init.headers?.Authorization !== `Bearer ${secret}`)
    return new Response("unauthorized", { status: 401 });
  if (!String(url).endsWith("/chat/completions"))
    return new Response("not found", { status: 404 });
  const body = JSON.parse(String(init.body));
  const system = String(body.messages?.[0]?.content ?? "");
  const prompt = String(body.messages?.[1]?.content ?? "");
  if (system.includes("rigorous mathematical contest tutor")) {
    receivedQuestion = prompt;
    return Response.json({
      choices: [
        {
          message: {
            content: JSON.stringify(
              forceInvalid
                ? { ...validPlan, methods: validPlan.methods.slice(0, 2) }
                : validPlan
            ),
          },
        },
      ],
    });
  }
  if (system.includes("Socratic Euclid contest tutor"))
    return Response.json({
      choices: [
        {
          message: {
            content: "先写出角平分线两侧边的比例；你能指出对应的两条边吗？",
          },
        },
      ],
    });
  return new Response("unexpected request", { status: 400 });
};

try {
  await mkdir(app.getPath("userData"), { recursive: true });
  const db = getDatabase(app);
  const now = new Date().toISOString();
  const sourceId = "11111111-1111-4111-8111-111111111111";
  const pageId = "22222222-2222-4222-8222-222222222222";
  const draftId = "33333333-3333-4333-8333-333333333333";
  db.prepare(
    "INSERT INTO source_documents (id, original_name, source_kind, stored_name, sha256, mime_type, size_bytes, imported_at) VALUES (?, ?, 'source_document', ?, ?, 'text/plain', 1, ?)"
  ).run(sourceId, "Euclid 2025.txt", "fixture.txt", "a".repeat(64), now);
  db.prepare(
    "INSERT INTO document_pages (id, source_document_id, page_number, ocr_text, created_at, ocr_status, review_status, updated_at) VALUES (?, ?, 1, ?, ?, 'reviewed', 'confirmed', ?)"
  ).run(pageId, sourceId, "Triangle ratio prompt", now, now);
  db.prepare(
    "INSERT INTO question_drafts (id, source_document_id, page_id, ordinal, label, title, prompt_text, review_status, created_at, updated_at) VALUES (?, ?, ?, 1, '第 1 题', '角平分线比例', ?, 'confirmed', ?, ?)"
  ).run(
    draftId,
    sourceId,
    pageId,
    "在三角形 ABC 中，AD 为角平分线，证明对应边长比例。",
    now,
    now
  );
  const [question] = publishQuestionDrafts(app, sourceId, [
    {
      questionDraftId: draftId,
      metadata: {
        sourceName: "Euclid",
        competitionYear: 2025,
        questionNumber: 1,
        primaryTopic: "几何",
        secondaryTopics: ["比例"],
        difficulty: 3,
        questionType: "证明",
        methods: ["相似"],
        proofRequired: true,
        estimatedMinutes: 10,
        maximumPoints: 5,
        scoringNotes: "比例闭合",
        priority: 2,
        tags: [{ category: "来源", value: "Euclid" }],
        subquestions: [],
      },
    },
  ]);
  await saveAiProvider(
    app,
    storage,
    {
      providerLabel: "Tutor mock",
      baseUrl: "https://mock.example/v1",
      model: "euclid-tutor-test",
      apiKey: secret,
      enabled: true,
    },
    "darwin"
  );
  await runAuthorizedTutorSession(
    app,
    storage,
    "00000000-0000-4000-8000-000000000000",
    "darwin"
  )
    .then(() => {
      throw new Error("Unauthorized tutor run was accepted.");
    })
    .catch(error => {
      if (!String(error.message).includes("不存在或已被使用")) throw error;
    });
  const preview = await prepareTutorSession(
    app,
    storage,
    { questionId: question.id },
    "darwin"
  );
  if (
    JSON.stringify(preview).includes(secret) ||
    preview.answerText ||
    !preview.disclosure.some(item => item.includes("不会上传原件"))
  )
    throw new Error(
      "Tutor preview leaked a secret or failed to disclose the send boundary."
    );
  const session = await runAuthorizedTutorSession(
    app,
    storage,
    preview.authorizationToken,
    "darwin"
  );
  if (
    session.plan?.methods.length !== 3 ||
    !receivedQuestion.includes(question.promptText) ||
    receivedQuestion.includes(secret)
  )
    throw new Error("Tutor plan was not safely generated with three methods.");
  const stored = getTutorSession(app, session.id);
  if (!stored?.plan || stored.messages.length !== 0)
    throw new Error("Tutor session plan was not stored locally.");
  const followedUp = await askTutorQuestion(
    app,
    storage,
    session.id,
    "我应该先写哪条比例？",
    "darwin"
  );
  if (
    followedUp.messages.length !== 2 ||
    followedUp.messages[0].role !== "user" ||
    followedUp.messages[1].role !== "assistant"
  )
    throw new Error(
      "Tutor question and answer were not saved as local messages."
    );
  forceInvalid = true;
  const invalidPreview = await prepareTutorSession(
    app,
    storage,
    { questionId: question.id },
    "darwin"
  );
  await runAuthorizedTutorSession(
    app,
    storage,
    invalidPreview.authorizationToken,
    "darwin"
  )
    .then(() => {
      throw new Error("Two-method tutor plan was accepted.");
    })
    .catch(error => {
      if (!String(error.message).includes("至少需要三种完整方法")) throw error;
    });
  const count = db
    .prepare("SELECT COUNT(*) AS count FROM tutor_sessions")
    .get();
  if (count.count !== 1)
    throw new Error("Invalid tutor response created a persisted session.");
  console.log(
    "Tutor authorization, three-method plan, local session, and Socratic follow-up smoke test passed"
  );
} finally {
  globalThis.fetch = originalFetch;
  closeDatabase();
  await rm(root, { recursive: true, force: true });
}
process.exit(0);
