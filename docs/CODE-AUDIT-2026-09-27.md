# My Euclid 代码质量审计报告

审计日期：2026-09-27
审计范围：`electron/`（主进程全部 12 个文件）、`client/src/`（除 `components/ui/` 的 shadcn 生成代码外全部业务代码）、构建配置、`docs/` 文档与实现一致性、`scripts/` 回归脚本。
审计方法：全量通读后端约 2,900 行与前端核心文件；`tsc --noEmit` 实测通过；对探索性结论逐条 grep 抽查验证（死代码、超长行、未用依赖等均已二次确认）。

---

## 1. 总体结论

**总评：6.5 / 10（以"优雅"为标准）。** 这是一个"后端远好于前端"的项目。

| 维度 | 评分 | 一句话结论 |
| --- | --- | --- |
| Electron 后端（数据/IPC/AI） | 8 / 10 | 边界校验、事务、加密、审计纪律接近范本；主要问题是 `database.ts` 巨石化 |
| React 前端（业务代码） | 5 / 10 | 类型契约优秀，但存在巨石组件、确凿死代码群、零封装桥接层和一个题库断链的功能级缺陷 |
| 安全 | 8 / 10 | 渲染进程沙箱、参数化 SQL、密钥加密、路径穿越防护齐全；扣分在"导入后自动 AI 审核"默认开启与隐私承诺冲突 |
| 工程化 | 7 / 10 | strict TypeScript 零错误、16 个真实回归脚本；Prettier 配置了却没执行，依赖清单严重超载 |
| 文档 | 7 / 10 | 数量和诚实度罕见地好；但已落后代码一个迭代，且存在内部矛盾 |
| 类型安全 | 9 / 10 | 业务代码零 `any`、零 `@ts-ignore`，`my-euclid.d.ts` 的 IPC 契约是全项目最大亮点 |

产品完成度相对 PRD 愿景约 **70–75%**：本地归档、OCR 审核链路、模考、AI 判卷/讲解、IRT 推荐是真实可用的（有代码 + 16 个回归脚本 + 实机验收记录三重证据）；KaTeX 数学渲染、题库直连单题训练、文件夹/URL 导入等仍是缺口。

---

## 2. 架构评估

架构选型克制且自洽：Electron（arm64）+ React 19 + Vite 7 + better-sqlite3 + Tesseract.js + pdf.js + sharp，AI 走 OpenAI 兼容接口。**本地优先、云端按需**的边界在数据模型层（`ai_run_audits` 审计表、`assessment_records.origin/status` 区分 AI 草案与人工确认）有真实落点，不是口头承诺。

两点保留意见：

1. **文档与代码的架构口径不一**：`docs/ARCHITECTURE.md` 写"SQLite + Drizzle ORM（计划）"和"KaTeX / MathJax"，而 `docs/AI-HANDOFF.md` 明令"不要引入 Drizzle"，代码里也没有任何 KaTeX。架构文档应改为描述现状。
2. **渲染层没有数据层**：无 zustand/react-query，45 处 `useState` 全部本地化，`notify` 回调穿越三层组件。在当前规模（约 4,500 行业务代码）尚可承受，但 `Home.tsx` 已到临界点（见 §4）。

---

## 3. 后端质量分析（electron/，约 2,900 行）

### 3.1 值得称为范本的部分

- **IPC 边界校验纪律**：`main.ts` 为每个 handler 配备 `requireLocalId`（UUID 格式白名单）、`requireNormalizedRect`、`requireAssessment` 等手工校验函数，输入长度/数量/取值范围全部显式设限（如 OCR 文本 50 万字符、笔迹 4,000 笔画）。
- **SQL 全参数化**：867 行 `database.ts` 中无一处字符串拼接 SQL 注入面；30 张表全部带 `CHECK` 约束与外键级联；迁移用 `PRAGMA user_version` 递进，幂等且可审。
- **密钥处理**（`ai-config.ts`）：`safeStorage` 加密后写 `secure/ai-provider-config.bin`（0600 权限 + tmp/rename 原子写），renderer 只见脱敏摘要；非 macOS 直接拒绝保存。措辞上这是"Keychain 派生密钥加密文件"，不是把 key 存进 Keychain 条目，文档表述宜修正。
- **AI 授权协议**（`ai-runtime.ts`）：一次性授权令牌 + 10 分钟过期 + 用后即焚；AI 返回的评分 JSON 做结构校验（评分依据合计必须等于总分、错因类别白名单、至少三种解法），不合格即拒收；每次调用落 `ai_run_audits`。AI 判卷只产 `origin='ai', status='draft'` 草案，永不直接计入报告。
- **健壮性细节**：`ai-authoring.ts` 的重试（3 次 + 退避 + 2.5s 节流）、分块切分失败逐页重试、整页兜底归档；`backup.ts` 恢复前先在 `recovery/` 留恢复点、manifest SHA-256 逐文件校验、`validateEntryName` 防路径穿越。

### 3.2 后端问题清单

| 位置 | 问题 | 级别 |
| --- | --- | --- |
| `electron/database.ts`（867 行） | 单文件承载 30 张表的迁移 + 全部 CRUD + IRT 数学 + tutor 存储，是后端唯一的巨石。建议按域拆为 schema/、questions/、assessment/、adaptive/ 模块 | P2 |
| `electron/main.ts:163` | `review:save-question-drafts` 未对 `sourceDocumentId` 做 `requireLocalId` 校验（其余 handler 均有）。且 `database.ts:482` 的 `saveQuestionDrafts` 不校验 `page_id` 是否属于该资料，理论上可把草案挂到其他资料的页面上。风险低（本地单用户、SQL 参数化），但破坏了该项目自己建立的"每个 ID 必验"纪律 | P2 |
| `electron/main.ts:226` | `practice:get-ink-response` 同样未验 `responseId` | P2 |
| `electron/ai-authoring.ts:23` | `ai-review.log` 只追加不轮转，长期使用会无限增长 | P3 |
| `electron/ai-runtime.ts:8,10` | `authorizations`/`tutorAuthorizations` 两个 Map 只在"使用后"删除，未使用的过期令牌驻留内存直至进程退出（量小，无实际危害） | P3 |
| `electron/ocr.ts:39` | 每次识别新建并销毁 Tesseract worker；批量导入扫描件时重复初始化开销明显 | P3 |
| `electron/main.ts` | 未设置 `setWindowOpenHandler` / `will-navigate` 防护。当前只加载本地文件、`openExternal` 仅放行 HTTPS，风险极低，但作为纵深防御建议补上 | P3 |

---

## 4. 前端质量分析（client/src 业务代码，约 4,000 行 + 900 行手写 CSS）

### 4.1 功能级缺陷（用户可感知）

**[P0] 题库 → 单题训练的链路是断的。**
`PublishedQuestionLibrary.tsx:25` 把真实题库 ID 传给 `openTraining(row.id)`，但 `Home.tsx:267` 的 `TrainingView` 用 `questions.find(q => q.id === initialId) ?? questions[0]` 回退到 `Home.tsx:77-81` 的**硬编码示例数组**。结果是：在题库里点任何一道真实题目的"训练"，看到的都是内置演示题面（"递推中的不变量"），作答也记在 `E-2025-07b` 这类演示 referenceKey 下，与真实题目无关。目前唯一走真实题目的作答路径是全真模考（`MockExamWorkspace` 直接使用题库快照，实现正确）。

**[P1] 导入后自动 AI 审核默认开启，与隐私承诺冲突。**
`Home.tsx:151` 的 `autoOn` 默认为"开"（localStorage 缺省即 true），导入完成后 `desktopImport`（`Home.tsx:459`）自动触发 `runAutoReviewSilently` → `ai.autoReviewAll()`，把导入资料的 OCR 文本**未经单次确认**发送给已配置的 AI 服务进行校对与切分发布。这直接违背了侧边栏文案"AI 请求由你主动发起"（`Home.tsx:93`）、`docs/AI-SECURITY.md` 与 `docs/AI-HANDOFF.md` 的"AI 不自动上传"验收项，也是 `TutorPanel.tsx:1` "不再作为人工关卡"注释所代表的一类系统性偏离：**最新一批 AI 功能改动（自动审核、变式、组卷、讲解免确认）全部未回写安全文档**。另注意：未配置 AI 服务时，每次导入都会收到一条"请先在 AI 服务中选择…"的错误 toast，体验突兀。

**[P1] `QuestionPublishPanel.tsx:16` 用户输入会被静默重置。**
`useEffect(() => setMetadata(...), [sourceDocumentId, drafts])` 以 `drafts` 为依赖，而审核面板里每敲一个字都会产生新的 `drafts` 数组引用 → 发布抽屉里已填写的来源/考点/满分全部被重置。发布抽屉与草案编辑器同屏可见（`Home.tsx:257`），这是真实可触发的输入丢失。修复：仅依赖 `sourceDocumentId` 初始化。

**[P2] 占位名"小明"泄漏到正式文案。**
`AssessmentWorkspace.tsx:20`（"每次真实判卷仍须由小明主动确认"）与 `:79`（"由小明手动录入"）。应为"你"或本地使用者名。

**[P2] 承诺了不存在的功能。**
作答区 placeholder 提示"公式可以使用 LaTeX 语法，例如 \frac{a}{b}"（`Home.tsx:298`），但项目没有引入 KaTeX/MathJax，`\frac{a}{b}` 将以原文显示。对数学备考工具这是核心体验缺口，至少应先改掉提示文案。

### 4.2 结构与可维护性

- **[P1] `Home.tsx` 是 473 行的"单文件应用"**，内含 16 个组件定义：`SideNav`、`Dashboard`、`ReviewWorkbench`（120 行 + 13 个 useState + 6 个异步函数）、`TrainingView`、`TrainingHub`、`ImportModal`、`BackupModal`、`TutorModal` 等。`TrainingHub` 甚至没有同名 tsx 文件，只有孤立的 `TrainingHub.css`。
- **[P1] 确凿死代码群**（均已 grep 验证零引用）：
  - `Home.tsx:314-319` `EvidenceView` 组件 + `:83-87` `evidenceItems` mock 数据（真实渲染走 `AssessmentWorkspace` 的 `EvidenceWorkspace`）；
  - `Home.tsx:392-396` `TutorModal` + `tutorOpen` 状态（`setTutorOpen(true)` 全项目零调用）；
  - `AssessmentWorkspace.tsx:31-48` `AiProviderPanel`（配置 UI 已由 `AiProvidersWorkspace` 承担）；
  - `hooks/useComposition.ts`、`useMobile.tsx`、`usePersistFn.ts` 三个 hook 共 122 行；
  - `App.tsx` 挂载的 sonner `Toaster` 与 `TooltipProvider`（业务代码从未调用 `toast()`/Tooltip，自绘 `.toast` 与其并存）；
  - `Home.tsx:45` 未使用的 `NotebookPen` 图标导入。
- **[P1] 桥接层零封装**：`window.myEuclid` 的存在性守卫在 11 个文件中出现 87 次（仅 `Home.tsx` 就 40 次）。没有 `lib/api.ts`，意味着错误处理无法统一、无法 mock、preload 改通道名要改散落 10 个文件。
- **[P1] 错误处理四类缺口**：① 完全无处理——`Home.tsx:202-209`（保存 OCR 无 try/catch、无防重复点击）、`Home.tsx:436-439`、`MockExamWorkspace.tsx:16`、`AssessmentWorkspace.tsx:25`、`AssessmentDiffPanel.tsx:5`，桥接一旦 reject 即 unhandled rejection 且界面无反馈；② 20 处逐字复制的 `try/setBusy/notify/finally` 样板；③ 表单级错误只有 3.5 秒 toast，无持久内联展示；④ 无任何日志/上报。
- **[P2] 超长单行书写**：`AiProvidersWorkspace.tsx:37` 单行 7,199 字符、`AssessmentWorkspace.tsx:79` 6,645、`AdaptiveTrainingWorkspace.tsx:18` 5,502、`Home.tsx:472` 1,600+。Prettier 已配置（printWidth 80）却从未执行，git diff 与 code review 实际失效。
- **[P2] 中文文案充当状态机**：`Home.tsx:64` `type View = "工作台" | "题库档案" | …`，`:262/272` 以 `"手写板书"` 字符串判断作答格式。改按钮文案就要动逻辑分支。
- **[P2] 重复实现**：`runAutoReview` 与 `runAutoReviewSilently` 孪生（`Home.tsx:153-171` vs `441-455`）；"浏览器预览不访问…" 降级 JSX 复制 9 份；`DesktopOnly` 组件在 `AiProvidersWorkspace` 内定义了却没推广；`import-ledger` 区块在 `LibraryView` 内逐字重复两份；`new Date(x).toLocaleString("zh-CN")` 散落 6 处。
- **[P2] 魔法值**：localStorage key 硬编码多处（`my-euclid.auto-review` ×3、`my-euclid.local-user-name` ×2）；模考常量"10 题 / 150 分钟"散落 6 处；`"E-2025-07b"` 演示 ID 渗入生产逻辑（`Home.tsx:422/462`）。

### 4.3 性能

- **[P1] `InkCanvas.tsx:75-110` O(n²) 全量重绘**：每个 `pointermove` 触发 `setActiveStroke` → effect `clearRect` 后重放全部历史笔画 + 当前笔画。长会话（数百笔画）必然卡顿。应增量绘制当前线段、已完成笔画不再重绘；`continueStroke` 的 `[...points, p]` 逐点复制数组也应改为 `push` + 脏标记。
- **[P1] `MockExamWorkspace.tsx:18` 每秒全量重渲染**：计时器挂 workspace 顶层，active 期间每秒重渲染含 100 题选择器在内的整棵树。应收缩到独立的 `<MockClock>` 组件。
- **[P2] `AssessmentWorkspace.tsx:79` 三组编辑列表用 `key={index}`**：删除中间项导致受控输入错位（`reOrdinal` 只救了 ordinal，不救焦点与输入状态）。
- **[P3] 做得对的**：定时器均有清理、`OcrRegionSelector` 正确使用 pointer capture、`Home.tsx:187-200` 的 `cancelled` 守卫模式正确（但未推广到其余 4 处异步 setState）。

### 4.4 样式与无障碍

- **[P1] 离线应用引 Google Fonts**：`index.css:2` 的 `@import url('https://fonts.googleapis.com/...')` 使这个"本地优先"的桌面应用首屏依赖外网；离线或网络受阻时阻塞渲染或字体回退漂移。应本地托管。
- **[P2] 双样式体系并存**：Tailwind v4 实际只服务于 `NotFound.tsx` 和 `ErrorBoundary.tsx` 两个文件（约 900 行业务样式全是手写 CSS，含 5 处 `!important`）。后果是这两个文件呈现 shadcn 蓝紫渐变 + 英文文案（"Page Not Found"、"An unexpected error occurred."），与"温暖档案纸"中文设计语言割裂。
- **[P2] Modal 无焦点管理**：均有 `role="dialog" aria-modal="true"`（好），但不支持 Esc 关闭、无初始焦点/焦点归还；`Home.tsx:117` 的 `more-button` 有 `aria-label` 却无 onClick，是装饰性死按钮。
- **[P3]** `body{min-width:1120px}`（`index.css:7`）宣告桌面专属，与存在但未使用的 `useIsMobile` hook 自相矛盾；`prefers-reduced-motion` 有覆盖，值得肯定。

### 4.5 依赖健康度

**[P1]** `components/ui/` 有 52 个 shadcn 组件，业务代码实际只用 4 个（且两个是无效挂载）。13+ 个生产依赖在 `client/src` 与 `electron/` 中均无引用（已 grep 验证）：`recharts`、`framer-motion`、`react-hook-form`、`@hookform/resolvers`、`zod`、`axios`、`streamdown`、`embla-carousel-react`、`vaul`、`cmdk`、`input-otp`、`next-themes`、`react-day-picker`、`react-resizable-panels`，另加 20 个 `@radix-ui/*` 大多只被未使用的 ui 组件引用。tree-shaking 能救打包体积，但拖累安装、安全审计面与升级成本。

---

## 5. 安全审计结论

| 项目 | 状态 |
| --- | --- |
| 渲染进程隔离 | ✅ `contextIsolation: true` + `sandbox: true` + `nodeIntegration: false`（`main.ts:137-143`） |
| SQL 注入 | ✅ 全参数化，无拼接 |
| IPC 输入校验 | ✅ 38 个 handler 中 36 个有显式校验；2 个缺 ID 校验（见 §3.2） |
| 密钥存储 | ✅ safeStorage 加密 + 0600 + 原子写；不入 SQLite、不进备份包（备份只含 sqlite/archive/manifest，`secure/` 被排除） |
| AI 传输边界 | ✅ 强制 HTTPS、无账号信息 URL；判卷/讲解只发文本，明确不上传附件与图片 |
| 路径穿越 | ✅ 备份 `validateEntryName` 双重校验 + 归档文件名 basename 校验（`review-media.ts:28-29`） |
| 外链 | ✅ 仅放行 HTTPS（`main.ts:254-258`） |
| CSP | ⚠️ `index.html` 无 CSP meta；当前仅加载本地资源，建议补 `default-src 'self'` 纵深防御 |
| 隐私默认值 | ⚠️ "导入后自动 AI 审核"默认开启 + 讲解免确认，与文档承诺的"逐次人工授权"边界冲突（见 §4.1）——这是本项目叙事层面最大的安全-产品矛盾 |

---

## 6. 文档一致性（docs/ vs 代码）

- **文档版本断层**：文档基线止于 2026-08-28（`ACCEPTANCE-MATRIX.md`），代码推进到 9 月 15 日。`ai-authoring.ts`（351 行）提供的 `autoReviewAllDocuments`、`generateVariantQuestions`、`composeMockExamWithAi` 三个能力在 docs/ 中**零记载**，AI-HANDOFF 的 IPC 表也漏了 `ai:auto-review-all`、`ai:generate-variants`、`ai:compose-mock-exam` 三个通道。
- **内部矛盾**：`DEVELOPMENT.md:187` 仍写"AI 判卷与 IRT 训练仍是后续功能"（实际均已实现）；`AI-SECURITY.md` 说"当前版本不发起网络评分请求"与 `ai-runtime.ts` 矛盾；ARCHITECTURE 的 Drizzle"计划"与 AI-HANDOFF"禁用 Drizzle"矛盾。
- **夸大项**：根 README"已确认的产品能力"表把"拖拽导入、导入文件夹、由 URL 导入"写成已确认能力，实际代码只有系统文件选择器多选导入（`archive.ts:27`）。
- **诚实项（值得肯定）**：`PROJECT-DEVELOPMENT-ARCHIVE.md` 与 `SIZE-AND-SCOPE-AUDIT.md` 主动承认"核心功能约 90%、公证与可直接分发约 30%"、Gatekeeper `spctl` 被拒、误触发 Web 模板升级已回滚；`ACCEPTANCE-MATRIX.md` 的 PASS/PARTIAL/BLOCKED 定义严格。这种自审诚实度在个人项目中罕见。
- **措辞修正**："密钥保存在 macOS Keychain"应改为"密钥经 Keychain 派生密钥（safeStorage）加密后保存在本地文件"。

---

## 7. 工程化

- ✅ `tsc --noEmit`（strict）实测零错误；`tsconfig.node.json` 开启 `noUnusedLocals/noUnusedParameters`。
- ✅ 16 个 `scripts/verify-*.mjs` 回归脚本真实覆盖归档、OCR、区域识别、笔迹、评分、模考、备份、AI、IRT 全链路。
- ❌ Prettier 配置存在但从未执行（超长行即证据）；建议接入 `prettier --check` CI 或 pre-commit。
- ❌ `tsconfig.json` 的 `include` 含不存在的 `shared/**/*`、`server/**/*`（模板残留）。
- ❌ 无单元测试框架的实际使用（vitest 在 devDependencies 中但零测试文件）；目前测试策略完全依赖端到端 verify 脚本，对纯函数（IRT 更新、normalizeAssessment）没有更快反馈环。
- ⚠️ `release/` 打包产物（约数百 MB 的 Electron Framework）混在源码目录里，应加入 `.gitignore`（当前项目未初始化 git，初始化时需一并处理）。

---

## 8. 问题优先级总表

**P0（功能错误，用户可直接踩中）**
1. 题库"训练"按钮打开的是示例题面，真实题目无法单题训练（`Home.tsx:267` vs `PublishedQuestionLibrary.tsx:25`）。
2. 发布抽屉元数据随打字被重置（`QuestionPublishPanel.tsx:16`）。

**P1（结构性风险 / 承诺失守）**
3. "导入后自动 AI 审核"默认开启 + 讲解免确认，违背自家隐私叙事；文档零记载（`Home.tsx:151/441-455`、`TutorPanel.tsx:1`、`ai-authoring.ts`）。
4. `Home.tsx` 巨石化 + 死代码群清理（EvidenceView/TutorModal/AiProviderPanel/三 hook/无效挂载）。
5. 建 `lib/api.ts` 桥接层 + `runWithBusy` 异步样板，修复 5 处静默失败。
6. 依赖大扫除（13+ 未用生产依赖）+ 样式体系定于一尊 + Google Fonts 本地化。
7. `InkCanvas` 增量绘制；`MockExamWorkspace` 计时器下沉。
8. 文档大版本更新（AI 自动审核三通道、讲解协议变更、Keychain 措辞、README 能力表纠偏）。

**P2（体验与一致性）**
9. "小明"占位名清理；LaTeX 提示文案与渲染实态对齐（引入 KaTeX 或改提示）。
10. 中文文案与逻辑解耦（View/mode 类型）、常量收敛到 `lib/constants.ts`。
11. `key={index}` → 稳定 ID；补 2 个 IPC handler 的 ID 校验；CSP；`ai-review.log` 轮转。
12. `database.ts` 按域拆分；Prettier 落地；`tsconfig` 幽灵目录清理。

**P3**
13. Tesseract worker 复用；授权 Map 过期清理；`setWindowOpenHandler`；模态焦点管理；删除装饰性 `more-button`。

---

## 9. 结语

这个项目呈现出明显的"双峰"形态：**后端是一部教科书**——校验、事务、加密、审计、回归脚本一应俱全，能看出作者对"可审计评分"的产品理念有真实的工程敬意；**前端则像是快速铺界面留下的工地**——巨石组件、死代码、复制粘贴与超长行并存，且最新一批 AI 功能为了顺滑体验悄悄放弃了项目最核心的"逐次授权"卖点而没有回写文档。

如果要排一个最小改动集：先修两个 P0（训练断链、元数据重置），再把"自动审核"改为默认关闭并在文档中如实描述三类 AI 自动能力的边界，然后做一次死代码与依赖的大扫除。做完这四件事，这个项目的工程质量形象就能与它的后端水准重新对齐。
