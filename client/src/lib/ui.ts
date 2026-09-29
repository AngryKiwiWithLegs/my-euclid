/** 界面文案映射：把英文状态/枚举与中文显示文案解耦，并集中日期格式化。 */

export type AnswerFormat = "keyboard" | "handwritten" | "paper_attachment";

const answerFormatNames: Record<AnswerFormat, string> = {
  keyboard: "键盘",
  handwritten: "笔迹",
  paper_attachment: "纸质附件",
};

export function answerFormatName(format: AnswerFormat): string {
  return answerFormatNames[format] ?? format;
}

export type MockExamStatus = "draft" | "active" | "submitted" | "archived";

const mockExamStatusNames: Record<MockExamStatus, string> = {
  draft: "尚未开始",
  active: "进行中",
  submitted: "已交卷",
  archived: "已归档",
};

export function mockExamStatusName(status: MockExamStatus): string {
  return mockExamStatusNames[status] ?? status;
}

export function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("zh-CN");
}
