/** 全局常量：localStorage 键、模考规格与演示数据标识，避免魔法值散落。 */

export const STORAGE_KEYS = {
  autoReview: "my-euclid.auto-review",
  localUserName: "my-euclid.local-user-name",
} as const;

export const MOCK_EXAM = {
  questionCount: 10,
  durationSeconds: 150 * 60,
} as const;

export const DEMO_QUESTION_ID = "E-2025-07b";

export function readLocalFlag(key: string, defaultValue: boolean): boolean {
  try {
    const stored = window.localStorage.getItem(key);
    return stored === null ? defaultValue : stored === "on";
  } catch {
    return defaultValue;
  }
}

export function writeLocalFlag(key: string, value: boolean): void {
  try {
    window.localStorage.setItem(key, value ? "on" : "off");
  } catch {
    /* 存储不可用时保持会话内状态 */
  }
}
