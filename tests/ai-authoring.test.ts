import { describe, expect, it } from "vitest";
import {
  asOptionalNumber,
  fallbackSelection,
  normalizeAiQuestion,
  parseAiJson,
} from "../electron/ai-authoring.js";
import type { QuestionBankQuestion } from "../electron/types.js";

const question = (
  id: string,
  primaryTopic: string,
  difficulty: number
): QuestionBankQuestion => ({
  id,
  sourceQuestionDraftId: `draft-${id}`,
  sourceDocumentId: "doc",
  pageId: "page",
  originalName: "原件.pdf",
  pageNumber: 1,
  label: id,
  title: `题目 ${id}`,
  promptText: "题面",
  status: "published",
  sourceName: "Euclid",
  primaryTopic,
  secondaryTopics: [],
  difficulty,
  questionType: "解答题",
  methods: [],
  proofRequired: false,
  scoringNotes: "",
  priority: 0,
  tags: [],
  subquestions: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

describe("parseAiJson", () => {
  it("解析裸 JSON、围栏 JSON 与夹杂文本", () => {
    expect(parseAiJson('{"questions":[]}')).toEqual({ questions: [] });
    expect(parseAiJson('```\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(() => parseAiJson("oops")).toThrow();
  });
});

describe("asOptionalNumber", () => {
  it("接受范围内的数字与数字字符串，越界或非数返回 undefined", () => {
    expect(asOptionalNumber(3, 1, 5)).toBe(3);
    expect(asOptionalNumber("4.5", 1, 5)).toBe(4.5);
    expect(asOptionalNumber(6, 1, 5)).toBeUndefined();
    expect(asOptionalNumber("abc", 1, 5)).toBeUndefined();
    expect(asOptionalNumber(undefined, 1, 5)).toBeUndefined();
  });
});

describe("normalizeAiQuestion", () => {
  it("接受多种常见字段命名并回填默认值", () => {
    const result = normalizeAiQuestion(
      {
        question_number_label: "3",
        name: "几何构造",
        text: "Prove that...",
        sub_questions: [{ label: "(a)", text: "Part a." }, { text: "Part b." }],
        metadata: { topic: "几何", difficulty: 4, maximum_points: 10 },
      },
      { pageId: "page-1", labelPrefix: "", sourceName: "Euclid 2025" },
      0
    );
    expect(result).not.toBeNull();
    const { draft, meta } = result!;
    expect(draft).toMatchObject({
      label: "3",
      title: "几何构造",
      promptText: "Prove that...",
      pageId: "page-1",
      ordinal: 1,
    });
    expect(draft.subquestions.map(sub => sub.label)).toEqual(["(a)", "(b)"]);
    expect(meta).toMatchObject({
      sourceName: "Euclid 2025",
      primaryTopic: "几何",
      difficulty: 4,
      maximumPoints: 10,
      questionType: "解答题",
    });
    expect(meta.subquestions[0].sourceSubquestionDraftId).toBe(
      draft.subquestions[0].id
    );
  });

  it("题面为空时返回 null，标签与考点回退到 fallback", () => {
    expect(
      normalizeAiQuestion(
        { text: "   " },
        { pageId: "p", labelPrefix: "v", sourceName: "S" },
        0
      )
    ).toBeNull();
    const fallback = normalizeAiQuestion(
      { prompt_text: "题面" },
      { pageId: "p", labelPrefix: "v", sourceName: "S" },
      2
    );
    expect(fallback!.draft.label).toBe("v3");
    expect(fallback!.draft.title).toBe("题目 3");
    expect(fallback!.meta.primaryTopic).toBe("未分类");
    expect(fallback!.meta.tags).toEqual([
      { category: "来源", value: "AI 自动审核", source: "ai_suggestion" },
    ]);
  });
});

describe("fallbackSelection", () => {
  it("跨考点轮转挑选恰好 10 道，且不重复", () => {
    const bank = [
      question("a1", "代数", 1),
      question("a2", "代数", 2),
      question("a3", "代数", 3),
      question("a4", "代数", 4),
      question("g1", "几何", 1),
      question("g2", "几何", 2),
      question("g3", "几何", 3),
      question("c1", "计数", 1),
      question("c2", "计数", 2),
      question("n1", "数论", 5),
    ];
    const picked = fallbackSelection(bank);
    expect(picked).toHaveLength(10);
    expect(new Set(picked).size).toBe(10);
    expect(picked).toContain("n1");
  });

  it("题库不足 10 道时返回全部可用题目", () => {
    const bank = [question("x1", "代数", 1), question("x2", "几何", 2)];
    expect(fallbackSelection(bank)).toHaveLength(2);
  });
});
