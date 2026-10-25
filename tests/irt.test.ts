import { describe, expect, it } from "vitest";
import {
  logistic,
  predictedProbability,
  questionParameter,
} from "../electron/db/adaptive.js";
import type {
  IrtItemParameter,
  QuestionBankQuestion,
} from "../electron/types.js";

const parameter = (
  overrides: Partial<IrtItemParameter> = {}
): IrtItemParameter => ({
  questionId: "q1",
  difficulty: 0,
  discrimination: 1,
  guessing: 0,
  source: "manual",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("logistic", () => {
  it("在 0 处返回 0.5，两端趋近 0/1 且不溢出", () => {
    expect(logistic(0)).toBe(0.5);
    expect(logistic(100)).toBeLessThan(1);
    expect(logistic(100)).toBeGreaterThan(0.99);
    expect(logistic(-100)).toBeGreaterThan(0);
    expect(logistic(-100)).toBeLessThan(0.01);
    expect(Number.isFinite(logistic(1e9))).toBe(true);
  });

  it("单调递增", () => {
    for (let x = -3; x < 3; x += 0.5) {
      expect(logistic(x + 0.5)).toBeGreaterThan(logistic(x));
    }
  });
});

describe("predictedProbability", () => {
  it("能力等于难度时，概率由猜测参数决定基线", () => {
    expect(predictedProbability(0, parameter({ guessing: 0 }))).toBeCloseTo(
      0.5,
      10
    );
    expect(predictedProbability(0, parameter({ guessing: 0.25 }))).toBeCloseTo(
      0.25 + 0.75 * 0.5,
      10
    );
  });

  it("能力越高正确率越高；能力越低越接近猜测下限", () => {
    const p = parameter({ difficulty: 0, discrimination: 1.4 });
    expect(predictedProbability(2, p)).toBeGreaterThan(
      predictedProbability(0, p)
    );
    expect(predictedProbability(0, p)).toBeGreaterThan(
      predictedProbability(-2, p)
    );
    expect(predictedProbability(-10, p)).toBeGreaterThan(0);
  });

  it("区分度放大能力差异", () => {
    const low = parameter({ discrimination: 0.3 });
    const high = parameter({ discrimination: 2.5 });
    expect(
      predictedProbability(2, high) - predictedProbability(-2, high)
    ).toBeGreaterThan(
      predictedProbability(2, low) - predictedProbability(-2, low)
    );
  });
});

describe("questionParameter", () => {
  const question = {
    id: "q9",
    difficulty: 4,
    updatedAt: "2026-02-02T00:00:00.000Z",
  } as QuestionBankQuestion;

  it("无手工参数时按题库难度生成启发式初值", () => {
    const derived = questionParameter(question);
    expect(derived).toEqual({
      questionId: "q9",
      difficulty: 0.8,
      discrimination: 1,
      guessing: 0,
      source: "heuristic",
      updatedAt: question.updatedAt,
    });
  });

  it("未设定难度时按默认 3 处理", () => {
    const derived = questionParameter({ ...question, difficulty: undefined });
    expect(derived.difficulty).toBe(0);
  });

  it("已保存的手工参数优先于启发式初值", () => {
    const manual = parameter({
      questionId: "q9",
      difficulty: -1.2,
      discrimination: 1.8,
      guessing: 0.2,
    });
    expect(questionParameter(question, manual)).toBe(manual);
  });
});
