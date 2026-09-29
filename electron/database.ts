/**
 * 数据库门面：实现按域拆分在 db/ 目录（connection/review/questionBank/mockExam/adaptive/tutor/practice/assessment/ink）。
 * 保留此 barrel 以维持既有 `from "./database.js"` 导入路径不变。
 */
export * from "./db/connection.js";
export * from "./db/review.js";
export * from "./db/questionBank.js";
export * from "./db/mockExam.js";
export * from "./db/adaptive.js";
export * from "./db/tutor.js";
export * from "./db/practice.js";
export * from "./db/assessment.js";
export * from "./db/ink.js";
