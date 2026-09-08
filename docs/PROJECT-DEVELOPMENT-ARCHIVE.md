# My Euclid 项目开发档案

**文档版本：** 2026-08-28  
**项目：** My Euclid 个人欧几里得数学竞赛备考客户端  
**作者：** My Euclid 开发记录（AI 协作维护）
**仓库：** `https://github.com/dfdd2001-source/my-euclid`（私有）

## 1. 项目定位

My Euclid 是面向个人使用的 macOS Apple Silicon 备考客户端。核心原则是**本地优先、用户掌握数据、AI 按次授权、原件到结论可追溯**。题源 PDF、页面、OCR 文本、题目草案、正式题库、作答版本、评分证据、错因、训练记录、知识图谱和 IRT 参数均以本地 SQLite 与应用私有档案目录为主；AI 只在用户明确确认后接收最小必要内容。

产品目标不是简单的题库阅读器，而是把“原始资料—人工核验—结构化题库—在线或纸面作答—评分依据—错题分析—苏格拉底式辅导—自适应训练”串成一个可审计闭环。

## 2. 当前状态结论

截至本次审计，GitHub 私有仓库 `dfdd2001-source/my-euclid` 的当前稳定提交为 `6ac5b8a`（本轮交接 checkpoint），其父提交 `4190a32` 已记录首次运行 `userData` 目录修复与交接审计，祖先提交 `f0e13b6` 为本地档案检查器里程碑。`git branch -vv` 显示本地 `main` 与 WebDev 的 `origin/main` 指向 `6ac5b8a`；GitHub 专用远端名为 `github`，历史中明确保留 Electron 功能和桌面基础里程碑（如 `92c6c45`、`cc6027d`、`2eb766e`、`915b57b`）。此前误触发的 Web 全栈能力升级已经回滚，`drizzle/` 残留未进入当前工作树；本轮只保留一个有意的数据库初始化修复：首次运行时递归创建 `app.getPath("userData")` 对应的父目录。

总体完成度建议按维度而不是单一百分比表达：核心产品功能约 **90%**，本地自动回归约 **95%**，Apple Silicon 实机验证约 **80%**，真实 AI 服务的用户授权链路约 **85%**，签名约 **80%**，公证与可直接分发约 **30%**。如果只问“能否继续个人备考使用”，答案是基本可以；如果问“是否已经达到可无说明地交付给任何 Mac 用户的公证安装包”，答案是否定的，仍需完成 Developer ID/公证及最终人工验收。

| 维度 | 状态 | 证据或边界 |
| --- | --- | --- |
| 本地资料归档 | 已实现 | `electron/archive.ts`、`electron/database.ts`、`scripts/verify-archive-flow.mjs` |
| OCR 与区域复核 | 已实现 | `electron/ocr.ts`、`electron/review-media.ts`、区域 OCR 回归脚本 |
| 题目/小问切分与题库发布 | 已实现 | `saveQuestionDrafts`、`publishQuestionDrafts`、题库流程脚本 |
| 键盘、手写、纸面作答 | 已实现 | `electron/practice.ts`、`InkCanvas`、备份与笔迹流程脚本 |
| 手工评分与报告 | 已实现 | `assessment_*` 表及评分报告脚本 |
| IRT 与知识依赖 | 已实现 | `adaptive` IPC、知识节点/边/IRT 参数和自适应脚本 |
| AI 多提供商配置 | 已实现 | Keychain/secure 文件存储、脱敏状态、配置安全脚本 |
| AI 评分 | 已实现为逐次授权草案流程 | 预览、十分钟授权令牌、结构化校验、人工确认计分 |
| AI Tutor | 已实现核心协议 | 至少三种讲解方法、会话和追问流程已覆盖脚本 |
| 浏览器预览 AI | 演示模式 | 不接收真实密钥，不执行真实请求 |
| arm64 DMG | 已生成并签名测试 | 实机日志显示 Apple Development 签名；Gatekeeper `spctl` 被拒绝，尚非公证发行状态 |
| 实机三份资料核对 | 待用户复跑 | 旧检查器因默认目录不存在而失败；本次已修复首次建目录逻辑 |

## 3. 架构与数据流

桌面壳由 Electron 负责窗口、原生文件选择、应用私有目录、Keychain/安全存储和 DMG 打包。渲染层为 React 19、TypeScript、Vite 7 与 Tailwind 4。主进程通过 `electron/preload.ts` 暴露最小化、类型约束的 `window.myEuclid` API，渲染进程不获得任意文件系统权限。数据层是 `better-sqlite3`，数据库文件名为 `my-euclid.sqlite`，迁移在 `electron/database.ts` 中按 user_version 递进至当前版本。

导入链路为：原始文件选择 → SHA-256 与元数据 → 私有档案复制 → 页面记录 → 本地文本提取/OCR → 页面和区域人工复核 → 题目/小问草案 → 用户确认 → 正式题库发布。作答链路为：题库/模拟考试 → 键盘或手写或纸面附件 → 版本化响应 → 手工或 AI 草案评分 → 逐项证据与错因 → 人工确认 → 报告和 IRT 更新。

> **审计原则：** AI 评分草案不是最终成绩。只有 `status=confirmed` 的评分档案才进入累计报告、模块统计和能力更新；AI 请求还必须经过用户可见预览和一次性授权。

## 4. 主要成果

第一，数据模型与用户需求的对应关系较完整。数据库不仅保存题目文本，还保存来源文档、页码、OCR 状态、题目草案、正式题库、小问、标签、作答版本、纸面附件、笔迹图层、评分证据、错因、模块拆分、AI 运行审计、知识依赖和 IRT 参数。因此，系统具备从原 PDF 到评分结论的回链基础，而不是只保留一个不可解释的分数。

第二，本地隐私边界设计清晰。AI key 不进入 SQLite、备份包或普通日志；预加载层只返回脱敏配置状态；AI 请求不因保存配置而自动发生；评分和辅导均采用逐次授权。该设计对个人学习工具尤其重要，因为用户的原始试卷、手写答案和长期能力数据不应被默认上传。

第三，验证脚本覆盖了核心业务闭环。当前已顺序通过 SQLite ABI、归档、练习与备份、笔迹、评分报告、AI/手工评分差异、AI 配置安全、题库、模拟考试、自适应训练和 Tutor 流程脚本。测试采用临时目录和临时数据库，避免污染用户数据。

第四，Apple Silicon 的实际问题被真实暴露并修复过，包括 preload ESM/CJS 不兼容、file protocol 资源路径、hash routing、按钮无反馈、注册入口与安全提示。经验表明，桌面应用不能只看浏览器预览，必须在目标架构上从打包产物启动。

## 5. 工程得失与经验教训

做得较好的部分是先建立“可追溯数据模型”，再扩展训练、评分和 AI；对 AI 采用最小载荷和逐次授权；将实机验收写成可执行脚本；把手写答案设计为版本化的结构化笔迹，而不是只保存一张图片；把人工评分与 AI 草案并列，避免 AI 结论未经审阅直接改变统计。

代价较明显的部分是功能面扩展较快，Electron、React、OCR、PDF、SQLite、Keychain、AI、IRT 和打包同时推进，使早期接口和文档一度出现“实现已前进但文档仍写后续功能”的滞后。例如 `docs/DEVELOPMENT.md` 中部分段落仍保留早期“AI 尚未接入”的表述，接手者应以代码、回归脚本和本档案的时间戳版本为准，并在下一轮统一文档。

另一个教训是不能把 Web 项目能力升级直接应用于本地 Electron 产品。最近一次能力升级自动提示了 tRPC、OAuth、Drizzle 和 Web fullstack 模板合并；这与 My Euclid 的本地 SQLite/Electron 目标不一致。正确做法是先查看 `git diff`、运行回归，再决定是否保留任何独立能力，而不是让模板文件进入产品。

最后，默认路径假设不足。旧检查器假设用户已经运行过应用并已经存在 `~/Library/Application Support/My Euclid`，导致“目录不存在”被误解为“没有导入数据”。本次将数据库初始化改为自动创建父目录，今后检查器还应把“首次运行、空库、已有库、显式自定义路径、权限错误、数据库损坏”分成不同状态。

## 6. 如果重新开发：更高效的计划

重新开发时应先冻结桌面产品边界，明确不引入 OAuth、云数据库或 Web fullstack 模板。第一阶段只建立 Electron 主进程、preload 白名单、React 空壳、SQLite 迁移、应用目录和最小备份；同时写出一条可在 Apple Silicon 上运行的 smoke test。第二阶段完成资料导入、页面/OCR、人工修订和题目切分，先用真实用户文件验证审计链，再做视觉细节。

第三阶段建立统一的 `practice session → response version → assessment record → report` 领域模型，并在此基础上实现键盘、手写和纸面附件三种输入。第四阶段实现题库标签、知识图谱和 IRT，先验证参数更新与冷启动提示，再连接 UI。第五阶段才加入 AI Provider、Keychain、请求预览、一次性授权、结构化校验和人工确认；真实网络测试与离线回归严格分离。

第六阶段集中做发布工程：arm64 构建、native module rebuild、preload CJS、file protocol、DMG layout、签名、Developer ID、公证、首次启动和数据迁移。每个阶段结束保存 checkpoint，并用一份小型真实资料做手工验收。这样可以把“功能完成”和“可分发安装包完成”分开，减少后期反复返工。

## 7. 当前未完成或需继续确认事项

当前最重要的下一步不是继续增加功能，而是：在用户的 Mac 上从最新源码拉取并运行一次修复后的检查器，确认默认 `userData` 路径、已有三份资料数量和题库数量；随后统一 `docs/DEVELOPMENT.md` 的过时状态；最后使用 Developer ID Application 证书和 Apple notarization 完成可分发发行链路。

不能由当前沙箱替用户读取 Mac 的真实 `userData`，也不应读取或保存 API key。因此，“三份资料已经真实存在”仍需用户端检查器输出作为证据。当前实机日志证明了 arm64 构建和签名测试，但 `spctl` 拒绝意味着不能把它描述为已公证安装包。

## 8. 参考证据

| 证据 | 用途 |
| --- | --- |
| `docs/PRD.md` | 原始产品目标与范围 |
| `docs/ARCHITECTURE.md` | 分层架构和 AI 边界 |
| `docs/DATA-MODEL.md` | 数据模型说明 |
| `docs/AI-SECURITY.md`、`docs/AGNES-AI-CONFIG.md` | 密钥与 AI 配置边界 |
| `docs/AI-ASSESSMENT.md`、`docs/AI-TUTOR.md` | AI 评分和 Tutor 协议 |
| `docs/IMPORT-EXPORT.md` | 导入、导出和备份说明 |
| `docs/MACOS-ARM64-ACCEPTANCE.md` | Apple Silicon 验收步骤 |
| `docs/MACOS-ARM64-ACCEPTANCE-RECORD.md` | 实机验收日志 |
| `scripts/verify-macos-arm64.sh` | 一键 arm64 验收 runner |
| `electron/preload.ts`、`electron/main.ts` | IPC 公共接口与注册 |
| `electron/database.ts` | SQLite schema、迁移和持久化 |
| `scripts/inspect-local-archive.mjs` | 本地档案数量检查器 |

## 9. Git 审计证据

本轮已通过 Git 历史核对关键提交链：`92c6c45 feat: add question bank mock exams and adaptive IRT training`、`cc6027d feat: add auditable Socratic tutor and score diff review`、`2eb766e fix: make macOS arm64 builder config valid`、`915b57b fix: use hash routing in packaged Electron app`、`7626ed8 fix: make local review and profile actions reliable`、`3bc112a fix: guide empty question confirmation`、`f0e13b6 feat: add local archive status inspector`、`4190a32` 交接审计和 `6ac5b8a` 当前启动脚本 checkpoint 均存在于当前分支历史。由于 WebDev `origin` 是受保护的 artifact remote，非交互 `git ls-remote origin` 不作为 GitHub 真实性证据；仓库完整性以预认证的 `github` 远端、当前分支历史和 GitHub CLI 审计为准。

## 10. 结论

My Euclid 已从概念验证推进到**可供个人继续使用的本地桌面 beta/候选交付版**。其最有价值的成果不是某个单独页面，而是建立了数据所有权、证据链、人工复核、AI 可撤销和自适应训练的共同底座。剩余工作主要集中在文档统一、真实 Mac 数据核验和公证发行，而不是再扩大功能范围。

**文档结论必须与 Git、回归脚本和用户实机结果一起阅读；本文件不替代最终人工验收。**

---

*本档案只引用仓库内的代码、脚本和已有验收记录；没有复制用户的真实题面、数据库内容或 API key。*

## References

[1]: `../electron/database.ts` — SQLite schema, migrations, and persistence implementation  
[2]: `../electron/preload.ts` — Renderer-to-main IPC contract  
[3]: `../scripts/verify-macos-arm64.sh` — Apple Silicon acceptance runner  
[4]: `../docs/MACOS-ARM64-ACCEPTANCE-RECORD.md` — Device acceptance record  
[5]: `../docs/DEVELOPMENT.md` — Existing development notes; some early status paragraphs require reconciliation

[1] [2] [3] [4] [5]

