# My Euclid 验收矩阵

**审计日期：** 2026-08-28  
**稳定基线：** `f0e13b6`  
**目标：** macOS Apple Silicon arm64

## 状态定义

- **PASS：** 在当前环境有直接、可复现的成功证据。
- **PARTIAL：** 代码或离线脚本已覆盖，但目标设备/真实服务仍需补证。
- **BLOCKED：** 存在已知阻断，不能对外宣称完成。
- **N/A：** 不属于个人本地版当前范围。

## 自动验收

| 区域 | 验收项 | 状态 | 证据 |
| --- | --- | --- | --- |
| 编译 | TypeScript 类型检查 | PASS | `pnpm check`；当前无 tsc 错误 |
| 编译 | Electron bundle | PASS | `pnpm build:electron` |
| 数据库 | SQLite ABI、迁移、外键 | PASS | `scripts/verify-sqlite.mjs` |
| 归档 | 原件复制、hash、导入任务和页面 | PASS | `scripts/verify-archive-flow.mjs` |
| OCR | 页面 OCR、区域 OCR、人工覆盖审计 | PASS | OCR/review 相关 verify 脚本 |
| 题库 | 题目草案、小问、发布和筛选 | PASS | `scripts/verify-question-bank-flow.mjs` |
| 作答 | 键盘响应、草稿、提交、版本化 | PASS | `scripts/verify-practice-backup.mjs` |
| 手写 | 图层、笔画、压力、回放和保存 | PASS | `scripts/verify-ink-flow.mjs` |
| 纸面 | 附件选择、复制和 response 回链 | PASS | practice/backup 验证 |
| 备份 | zip、manifest、SHA-256、恢复点、恢复 | PASS | `scripts/verify-practice-backup.mjs` |
| 评分 | 手工评分、证据、错因、模块报告 | PASS | `scripts/verify-assessment-report.mjs` |
| 差异审阅 | AI/手工评分差异和人工确认边界 | PASS | `scripts/verify-assessment-diff-flow.mjs` |
| AI 配置 | 多 Provider、启停、默认和脱敏 | PASS | `scripts/verify-ai-config-security.mjs` |
| AI 运行 | 连接、模型发现、授权令牌、结构化草案 | PASS/PARTIAL | `scripts/verify-ai-runtime.mjs`；真实 provider 仍需设备验证 |
| 模拟考试 | 创建、开始、提交和状态 | PASS | `scripts/verify-mock-exam-flow.mjs` |
| IRT | 知识节点/边、参数和自适应推荐 | PASS | `scripts/verify-adaptive-training-flow.mjs` |
| Tutor | 三种方法、预览、会话追问 | PASS/PARTIAL | `scripts/verify-tutor-flow.mjs`；真实服务需设备验证 |
| 本地资料检查 | 空目录首次运行 | PASS | 本次新增 `mkdirSync(..., {recursive:true})` 后临时目录通过 |

## Apple Silicon 实机

| 项目 | 状态 | 说明 |
| --- | --- | --- |
| arm64 bundle | PASS | 用户 Mac 已构建成功 |
| DMG 布局与完整性 | PASS | `verify-macos-arm64.sh` 输出 PASS |
| preload 运行 | PASS | ESM/CJS preload 问题已修复 |
| 首屏资源 | PASS | 相对 asset 路径和 hash routing 已修复；历史上曾出现 404 |
| 原生 SQLite/依赖 | PASS | 目标 Mac 构建和回归曾通过 |
| 签名 | PARTIAL | 日志显示 Apple Development 签名 |
| Gatekeeper | BLOCKED | `spctl --assess` 被拒绝 |
| 公证 | BLOCKED | 未见 notarization ticket 成功证据 |
| 首次 userData | PARTIAL | 本次代码已创建父目录，需用户 Mac 重新运行 |
| 已导入三份资料 | UNVERIFIED | 不能从沙箱读取用户 Mac userData；需检查器摘要 |
| 注册/配置入口 | PASS | 注册按钮已改为本地 profile editor；AI 配置页具备反馈 |

## 安全验收

| 控制项 | 状态 | 约束 |
| --- | --- | --- |
| 不要求外部账户注册 | PASS | 本地 profile 编辑器；不把任何外部平台 OAuth 当作桌面产品需求 |
| API key 不进 SQLite | PASS | 安全存储边界和测试覆盖 |
| API key 不进备份 | PASS | 备份只包含本地业务数据和文件，不含 key |
| Renderer 无任意 fs | PASS | 通过 preload 白名单调用 |
| AI 不自动上传 | PASS | prepare → 可见 preview → 用户授权 → run |
| AI draft 不直接计分 | PASS | `status=draft`，人工确认后才进入统计 |
| 日志不记录密钥/题面 | PASS/需持续审查 | 新增日志须保持摘要化 |
| 真实用户文件不进仓库 | PASS | 审计过程只使用代码和摘要 |

## 最终人工清单

1. 在目标 Mac 关闭已安装旧版应用，拉取 `main`，运行 `pnpm install --frozen-lockfile`、`pnpm rebuild:native` 和 `bash scripts/verify-macos-arm64.sh`。
2. 启动最新 DMG 中的应用，确认首屏无 404，应用提示来自本地 profile 而非强制注册。
3. 运行 `inspect-local-archive.mjs`，确认输出 source document/import job/question 数量；不要复制题面和密钥。
4. 导入一份测试 PDF 和一份纸面答案，检查原件、页面、OCR、草案、题库发布、作答、评分和报告回链。
5. 在 AI 配置页填写 Agnes AI 的 OpenAI-compatible base URL、model 和 API key；只在用户自己的终端输入 key，不在聊天、日志或仓库中粘贴。
6. 执行一次连接测试和模型发现，再执行评分预览；确认未点击授权前没有网络请求，授权后生成的是 draft，人工确认后才更新报告。
7. 执行 Tutor 预览和至少一次追问，确认三种方法都可见且会话能继续。
8. 若用于分发，改用 Developer ID Application 证书、完成 notarization，并再次执行 `spctl --assess --type execute` 和 DMG 安装启动测试。

## 不应作为验收证据的内容

浏览器预览的演示 AI Provider、只显示 UI 的成功 toast、没有用户授权的 AI mock、未运行过应用时的默认路径报错、Apple Development 签名本身、以及 `spctl` 被拒绝时的“构建通过”日志，都不能单独证明最终产品已达到公证发行状态。

## 复验记录模板

```text
Date:
Mac model / macOS:
Commit:
Node / pnpm:
DMG path:
Source documents:
Import jobs:
Question-bank questions:
Practice sessions:
Assessment records:
AI provider test:
AI assessment authorization:
Tutor follow-up:
spctl result:
Notes:
```

## 结论

离线业务和核心安全边界已达到可交付 beta 水平；最终发行仍受真实目标 Mac 资料摘要、真实 AI provider 操作和 Apple notarization 三项证据约束。
