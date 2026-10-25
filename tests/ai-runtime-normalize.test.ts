import { describe, expect, it } from "vitest";
import {
  normalizeAssessment,
  normalizeTutorPlan,
  parseJson,
} from "../electron/ai-runtime.js";
import type { AuthorizedAssessment } from "../electron/ai-runtime.js";

const preview = (): AuthorizedAssessment => ({
  authorizationToken: "token",
  expiresAt: "2026-01-01T10:00:00.000Z",
  providerId: "p1",
  providerLabel: "测试服务",
  model: "test-model",
  sessionTitle: "会话",
  referenceKey: "ref",
  answerFormat: "keyboard",
  questionText: "题面",
  answerText: "作答",
  scoreMaximum: 10,
  attachments: [],
  disclosure: [],
  responseId: "r1",
  sessionId: "s1",
});

const validPayload = JSON.stringify({
  score_awarded: 7,
  score_maximum: 10,
  summary: "摘要",
  overall_feedback: "整体反馈",
  evidence: [
    {
      criterion: "构造不变量",
      maximum_points: 6,
      awarded_points: 4,
      rationale: "依据",
      response_quote: "摘录",
    },
    {
      criterion: "完成归纳",
      maximum_points: 4,
      awarded_points: 3,
      rationale: "依据2",
      response_quote: "",
    },
  ],
  mistakes: [
    {
      category: "conceptual",
      severity: "moderate",
      module: "数列",
      note: "说明",
    },
  ],
  modules: [
    { module: "递推", maximum_points: 10, awarded_points: 7, note: "" },
  ],
});

describe("parseJson", () => {
  it("解析裸 JSON 与 ```json 围栏", () => {
    expect(parseJson(validPayload)).toHaveProperty("score_awarded", 7);
    expect(parseJson("```json\n" + validPayload + "\n```")).toHaveProperty(
      "score_awarded",
      7
    );
  });

  it("从夹杂文本中截取首尾花括号之间的内容", () => {
    expect(parseJson(`说明文字 {"a":1} 尾部`)).toEqual({ a: 1 });
  });

  it("无 JSON 内容时抛错", () => {
    expect(() => parseJson("没有结构化内容")).toThrow();
  });
});

describe("normalizeAssessment", () => {
  it("接受总分一致的规范输出，并强制保存为 AI 草案", () => {
    const result = normalizeAssessment(validPayload, preview());
    expect(result).toMatchObject({
      sessionId: "s1",
      responseId: "r1",
      status: "draft",
      scoreAwarded: 7,
      scoreMaximum: 10,
    });
    expect(result.evidence).toHaveLength(2);
    expect(result.evidence[0]).toMatchObject({
      criterion: "构造不变量",
      ordinal: 1,
    });
    expect(result.mistakes[0]).toMatchObject({
      category: "conceptual",
      severity: "moderate",
      ordinal: 1,
    });
  });

  it("评分依据合计与总分不一致时拒绝", () => {
    const payload = JSON.parse(validPayload);
    payload.score_awarded = 8;
    expect(() =>
      normalizeAssessment(JSON.stringify(payload), preview())
    ).toThrow("评分依据合计与总分不一致");
  });

  it("总分越界或与满分不符时拒绝", () => {
    const payload = JSON.parse(validPayload);
    payload.score_awarded = -1;
    expect(() =>
      normalizeAssessment(JSON.stringify(payload), preview())
    ).toThrow();
    const overMax = JSON.parse(validPayload);
    overMax.score_maximum = 8;
    expect(() =>
      normalizeAssessment(JSON.stringify(overMax), preview())
    ).toThrow();
  });

  it("未知错因类别时拒绝", () => {
    const payload = JSON.parse(validPayload);
    payload.mistakes[0].category = "surprise";
    expect(() =>
      normalizeAssessment(JSON.stringify(payload), preview())
    ).toThrow("AI 错因类别格式无效");
  });

  it("没有评分依据时拒绝", () => {
    const payload = JSON.parse(validPayload);
    payload.evidence = [];
    expect(() =>
      normalizeAssessment(JSON.stringify(payload), preview())
    ).toThrow("至少需要一条评分依据");
  });
});

describe("normalizeTutorPlan", () => {
  const plan = (methods: number, extra: Record<string, unknown> = {}) =>
    JSON.stringify({
      prerequisite_knowledge: ["递推", "归纳"],
      entry_point: "切入点",
      thought_source: "思路来源",
      methods: Array.from({ length: methods }, (_, index) => ({
        name: `方法${index}`,
        outline: "概要",
        key_idea: "关键",
        pitfalls: "误区",
      })),
      similar_type: "同类题",
      variants: ["变式一", "变式二"],
      socratic_question: "追问",
      ...extra,
    });

  it("接受三种方法的完整计划", () => {
    const result = normalizeTutorPlan(plan(3));
    expect(result.methods).toHaveLength(3);
    expect(result.prerequisiteKnowledge).toEqual(["递推", "归纳"]);
    expect(result.variants).toHaveLength(2);
  });

  it("少于三种方法时拒绝", () => {
    expect(() => normalizeTutorPlan(plan(2))).toThrow("至少需要三种完整方法");
  });

  it("缺少切入点或苏格拉底追问时拒绝", () => {
    expect(() => normalizeTutorPlan(plan(3, { entry_point: "" }))).toThrow(
      "切入点或苏格拉底追问"
    );
    expect(() =>
      normalizeTutorPlan(plan(3, { socratic_question: "" }))
    ).toThrow("切入点或苏格拉底追问");
  });
});
