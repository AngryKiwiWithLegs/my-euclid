# My Euclid AI Handoff

**目标：** 让新的 AI agent 在不读取用户隐私、不猜测状态、不误改架构的前提下快速接手 My Euclid。  
**项目路径：** `/home/ubuntu/euclid-prep-client`  
**GitHub：** `https://github.com/dfdd2001-source/my-euclid`（private，`main`）  
**当前稳定提交：** `f0e13b6`  
**桌面目标：** macOS Apple Silicon `arm64`  
**最近本地修复：** `electron/database.ts` 在打开 `my-euclid.sqlite` 前递归创建 `userData` 父目录。

## 接手前的硬性规则

不要把本项目升级成 OAuth、tRPC、Drizzle、MySQL 或云端 Web 应用。那是一次误触发的 Web 模板能力升级产生的提示，不是产品需求。My Euclid 的真实架构是 Electron + React + better-sqlite3 + 本地应用目录 + 可选的 OpenAI-compatible AI Provider。

不要读取、打印、提交或备份用户的 API key、Keychain 内容、`~/Library/Application Support/My Euclid` 真实题面、纸面答案或手写数据。不要用 mock review、假评分或假用户资料冒充真实验收。不要执行破坏性 SQL、删除用户数据库或使用 `git reset --hard`。需要恢复时使用 checkpoint/rollback。

## 最短接手路径

```bash
git clone https://github.com/dfdd2001-source/my-euclid.git
cd my-euclid
pnpm install
pnpm check
pnpm build:electron
pnpm exec electron --runAsNode scripts/verify-sqlite.mjs
pnpm exec electron --runAsNode scripts/verify-archive-flow.mjs
```

完整离线回归命令是：

```bash
pnpm build
for test in \
  scripts/verify-sqlite.mjs \
  scripts/verify-archive-flow.mjs \
  scripts/verify-practice-backup.mjs \
  scripts/verify-ink-flow.mjs \
  scripts/verify-assessment-report.mjs \
  scripts/verify-assessment-diff-flow.mjs \
  scripts/verify-ai-config-security.mjs \
  scripts/verify-question-bank-flow.mjs \
  scripts/verify-mock-exam-flow.mjs \
  scripts/verify-adaptive-training-flow.mjs \
  scripts/verify-tutor-flow.mjs; do
  pnpm exec electron --runAsNode "$test" || exit 1
done
```

目标 Mac 上使用：

```bash
cd "$HOME/Documents/My Euclid/my-euclid"
git pull --ff-only origin main
pnpm install --frozen-lockfile
pnpm rebuild:native
bash scripts/verify-macos-arm64.sh
```

检查用户本地资料时，应用首次运行后可使用：

```bash
pnpm build:electron
MY_EUCLID_USER_DATA="$HOME/Library/Application Support/My Euclid" \
  pnpm exec electron --runAsNode scripts/inspect-local-archive.mjs
```

如果应用使用了自定义 Electron userData 路径，必须显式传入 `MY_EUCLID_USER_DATA`；检查器输出为汇总数量，不应打印题面或密钥。

## 目录地图

| 路径 | 责任 |
| --- | --- |
| `electron/main.ts` | BrowserWindow、IPC handler、文件选择、窗口启动、开发/生产资源路径 |
| `electron/preload.ts` | 唯一渲染桥；只暴露 `window.myEuclid` 白名单 API |
| `electron/database.ts` | SQLite 文件、v1-v11 迁移、查询、写入、报告、题库和 IRT |
| `electron/archive.ts` | 原始资料复制、哈希、PDF/图片归档、OCR 任务 |
| `electron/ocr.ts` | 本地 OCR 和页面文本处理 |
| `electron/review-media.ts` | 页面预览、区域裁剪和区域 OCR 审计 |
| `electron/practice.ts` | 键盘/纸面/手写响应持久化 |
| `electron/backup.ts` | `*.myeuclid-backup.zip` 导出、预检、恢复和 hash 清单 |
| `electron/ai-config.ts` | 多 Provider 配置和安全存储 |
| `electron/ai-runtime.ts` | Provider 连接、模型发现、AI 评分和 Tutor 请求 |
| `client/src/pages/Home.tsx` | 主工作台、hash routing 和页面交互 |
| `client/src/components/InkCanvas.tsx` | 手写笔迹 UI；若路径改变先用 `find client -iname '*Ink*'` 核对 |
| `scripts/verify-*.mjs` | 离线临时数据库回归 |
| `scripts/verify-macos-arm64.sh` | Apple Silicon 构建、打包、DMG 验收 runner |
| `scripts/inspect-local-archive.mjs` | 用户端本地资料只读汇总检查器 |
| `docs/` | PRD、架构、安全、AI、导入导出、验收和交接资料 |
| `todo.md` | 功能历史与当前任务清单；永不删除历史条目 |

## IPC 协议

以下接口通过 `contextBridge` 暴露，不要从 renderer 直接调用 Node `fs`、`path`、Keychain 或 Electron API。

| 命名空间 | 方法 | 作用 |
| --- | --- | --- |
| `archive` | `getHealth`, `listImportJobs`, `selectAndImport(kind)` | 归档健康状态、导入任务、选择并导入 `source_document` 或 `paper_response` |
| `review` | `listDocuments`, `getDocument`, `getPagePreview`, `recognizeRegion`, `updatePageOcr`, `saveQuestionDrafts`, `publishQuestionDrafts` | OCR 复核、题目切分和正式题库发布 |
| `library` | `listQuestions(filter)`, `getQuestion(id)` | 正式题库只读访问 |
| `mockExam` | `list`, `get`, `create`, `start`, `submit` | 模拟考试生命周期 |
| `adaptive` | `getProfile`, `saveNode`, `saveEdge`, `saveItemParameter` | 知识图谱和 IRT 参数 |
| `assessment` | `listSessions`, `listRecords`, `getRecord`, `getDashboard`, `saveManual` | 评分记录、证据、报告和累计统计 |
| `ai` | Provider registry/save/default/remove、`testProvider`、`listModels` | 配置和连接测试 |
| `ai` | `prepareAssessment`, `runAssessment` | 显示评分发送预览后，凭一次性授权令牌运行 AI 草案评分 |
| `ai` | `prepareTutor`, `runTutor`, `askTutor` | Tutor 预览、首次运行、会话追问 |
| `practice` | `saveResponse`, `selectPaperAttachments`, `saveInkResponse`, `getInkResponse` | 三种作答形态和版本化响应 |
| `backup` | `export`, `selectForRestore`, `restore(token)` | 本地备份和恢复 |
| `app` | `openExternal(url)` | 受限外部链接打开 |

输入输出的权威类型在 `electron/types.ts`；不要在 UI 中复制一份结构。关键 AI 类型包括 `AiProviderConfigInput`、`AiAssessmentPrepareInput`、`AiAssessmentPreview`、`AiAssessmentRunResult`、`TutorPrepareInput` 和 `TutorPreview`。

## AI 协议和安全边界

Provider 使用 OpenAI-compatible HTTPS `chat/completions` 形式。配置字段为 `providerLabel`、`baseUrl`、`model`、可选 `apiKey` 和 `enabled`。API key 只进入安全存储，列表和预加载状态均脱敏。保存配置不会上传学习资料。

评分流程必须遵循：选择 session/response → `prepareAssessment` → 展示题面、答卷、满分、附件和 disclosure → 用户明确确认 → `runAssessment(authorizationToken)` → 校验结构化响应 → 写入 `origin="ai"`, `status="draft"` → 用户人工确认 → 才进入报告。令牌短期有效，当前预览显示十分钟期限。不得把 AI draft 当成 confirmed score。

Tutor 流程同样先准备并展示发送范围，再由用户授权。Tutor 计划应至少保留三种方法，并支持会话追问；不要在没有真实请求证据时声称“AI 已经解答了某道用户题目”。

## 数据与迁移

数据库文件为：

```text
<app.getPath("userData")>/my-euclid.sqlite
```

`getDatabase(app)` 现在会先创建父目录，再打开 SQLite；所有迁移集中在 `electron/database.ts`，不要单独创建第二套 schema。当前数据模型至少覆盖：`source_documents`、`document_pages`、`import_jobs`、`question_drafts`、`subquestion_drafts`、`question_bank`、`practice_sessions`、`practice_responses`、`response_attachments`、`ink_layers`、`ink_strokes`、`assessment_records`、`assessment_evidence`、`assessment_mistakes`、`assessment_modules`、`ai_run_audits`、知识节点/边和 IRT 参数。

修改 schema 时先写迁移逻辑，再用临时目录回归；不要对用户库做 destructive migration。备份恢复必须保留 hash 清单和自动恢复点。

## 验收矩阵

### 已在沙箱验证

`pnpm check` 无 TypeScript 错误；`pnpm build:electron` 成功；空 userData 临时目录运行 `inspect-local-archive.mjs` 成功并返回 0 条汇总；SQLite ABI、归档、备份、笔迹、评分、AI 配置、题库、模拟考试、自适应和 Tutor 回归脚本均通过。

### 已在用户 Apple Silicon Mac 观察到

arm64 构建、DMG 布局和完整性检查通过；应用曾出现 preload ESM/CJS 不兼容、资源路径和首屏 404 等问题，已有修复；签名输出显示 Apple Development 证书。但 `spctl --assess` 被拒绝，说明当前不能当作已公证的公开发行包。浏览器预览中的 AI 服务是演示模式，不代表真实 AI 网络链路。

### 仍需用户端确认

用户需要重新拉取最新提交并运行检查器，确认默认 userData 路径及三份资料的实际摘要；需要在真实 Agnes AI/兼容 Provider 下完成一次用户主动授权、结构化草案和人工确认；需要用 Developer ID Application 和 notarization 完成可直接分发的 DMG。

## 下一 AI 的执行顺序

第一步只做 `git status`、`git log -5`、`git remote -v` 和 `pnpm check`，确认没有模板残留。第二步阅读本文件、`docs/PROJECT-DEVELOPMENT-ARCHIVE.md`、`docs/MACOS-ARM64-ACCEPTANCE-RECORD.md`、`electron/preload.ts` 和 `electron/database.ts`。第三步运行离线回归，不连接真实 AI。第四步若处理用户 Mac 数据，只使用 `inspect-local-archive.mjs` 的数量摘要。第五步在任何新功能前把条目加入 `todo.md`，功能完成立即标记。第六步在代码、测试和文档都完成后保存 checkpoint，再向用户报告。

## 目前建议的首个后续任务

首个后续任务是“完成最后一公里发布验收”，而不是增加新模块：更新过时的 `docs/DEVELOPMENT.md` 状态文字；为检查器补充明确的 `first_run`、`empty_archive`、`permission_denied` 和 `database_corrupt` 状态；在用户 Mac 上验证已有导入资料；最后重新构建、签名、公证并记录版本。

## 不应误读的事实

仓库中存在早期文档段落，可能仍写着 AI 或 IRT“后续实现”。这些段落是开发历史，不应覆盖当前代码和回归证据，但也不能反过来把本地 mock 回归写成真实用户 AI 结果。正确状态是：核心协议和本地实现已完成，真实服务和公证分发仍需要目标设备上的最终证据。

## 参考文件

[1]: `../electron/preload.ts` — IPC contract  
[2]: `../electron/main.ts` — IPC registration and desktop runtime  
[3]: `../electron/database.ts` — SQLite and migrations  
[4]: `../electron/types.ts` — Shared domain input/output types  
[5]: `../scripts/verify-macos-arm64.sh` — arm64 acceptance  
[6]: `../scripts/inspect-local-archive.mjs` — local archive inspector  
[7]: `./PROJECT-DEVELOPMENT-ARCHIVE.md` — project summary and redevelopment plan  
[8]: `./MACOS-ARM64-ACCEPTANCE-RECORD.md` — real-device acceptance record

[1] [2] [3] [4] [5] [6] [7] [8]
