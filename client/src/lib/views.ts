/** 视图与通知的共享类型：英文标识符承担逻辑，中文文案只出现在映射表。 */

export type View =
  | "dashboard"
  | "library"
  | "review"
  | "training"
  | "evidence"
  | "reports"
  | "ai";

export type ImportKind = "source" | "paper" | "answer" | null;

export type Notify = (message: string, duration?: number) => void;
