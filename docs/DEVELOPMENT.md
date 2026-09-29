# 开发说明

## 当前阶段

仓库现已包含 Electron 桌面壳、受限预加载 API、SQLite 本地数据库与真实资料归档。React 工作台中的“导入资料”和“上传纸质答卷”在 Electron 模式下会调用 macOS 原生文件选择器，将用户选择的文件复制到应用私有档案目录，并创建可持久化的审核任务。题号自动识别与摄像头仍是后续功能；AI 判卷（逐次授权）、AI 自动审核（默认关闭）、互动讲解与 IRT 自适应训练已实现，不会在本版本中被误表述为超出实际边界。

页面级本地文本提取、图片 OCR、人工 OCR 修订以及题目/小问切分确认现已实现。扫描 PDF 会由 PDF.js 在本地逐页渲染为页面预览；审核者可拖拽框选任意区域，调用本地 Tesseract 重新识别。区域坐标、裁剪哈希、缩略图、文本与状态均作为独立审计记录保存，只有人工点击“采用文本”并保存页面后，内容才会进入正式 OCR 文本。

训练页现将键盘作答、手写板书与纸质答案附件保存为同一训练会话下的独立版本。桌面模式下，输入框失焦会写入草稿；“保存草稿”和“提交并分析”会分别创建可追溯的版本记录。纸质答案通过原生文件选择器导入并复制到私有档案目录。

本地备份入口会生成 `*.myeuclid-backup.zip`。备份含 SQLite 数据库、题源原件、答卷附件及带 SHA-256 的清单；恢复前必须完成文件路径和哈希预检。恢复采用覆盖替换策略，主进程会先创建当前档案的自动恢复点。端到端验证可运行：`pnpm build:electron && pnpm exec electron --runAsNode scripts/verify-practice-backup.mjs`。

训练页的“手写板书”现已提供 Pointer Events 画布。它保留图层、归一化笔画坐标、压力、相对时间和 SVG 快照，支持画笔、橡皮擦、撤销、重做、清空与按笔画顺序回放。保存时会创建独立的 `handwritten` 答卷版本；由于全部笔迹数据位于 SQLite 中，既有备份与恢复不需要额外配置。端到端验证可运行：`pnpm build:electron && pnpm exec electron --runAsNode scripts/verify-ink-flow.mjs`。

错题证据与报告页现由本地评分档案驱动。评分档案包含答卷版本回链、总分、逐条评分依据、错因和模块拆分；只有确认评分才会进入累计得分率、最近得分率、模块表现、错因分布和评分轨迹。AI 判卷尚未接入：当前没有用户配置的服务或密钥，故不会生成任何伪造 AI 结论。评分与备份恢复验证可运行：`pnpm build:electron && pnpm exec electron --runAsNode scripts/verify-assessment-report.mjs`。

“AI 服务”独立页面仅在目标 macOS 上、Electron Keychain 可用时启用。用户可自行维护多个 OpenAI 兼容 HTTPS 服务、模型和默认提供商；密钥始终加密保存在应用私有 `secure/` 目录，预加载桥只返回脱敏状态，且配置不在 SQLite 或 `.myeuclid-backup.zip` 内。保存、启用或切换默认服务不会自动上传资料；真实判卷先展示发送范围并由用户逐次确认，AI 输出经结构化校验后只写入待审核草案。安全边界验证可运行：`pnpm build:electron && pnpm exec electron --runAsNode scripts/verify-ai-config-security.mjs`。

AI 服务页现可主动测试连接并发现提供商返回的模型标识。错题证据页可为指定题面与答卷版本生成十分钟有效的发送预览；只有点击“确认发送并生成评分草案”后才会发起一次 `chat/completions` 请求。题面文本、答卷文本和满分会在发送前可见，当前不会上传纸质附件、扫描图像或笔迹二进制数据。成功结果经本地结构化校验后写入 `origin=ai`、`status=draft` 的评分档案，仍需人工确认才计入报告。网络调用与结构化草案验证可运行：`pnpm build:electron && pnpm exec electron --runAsNode scripts/verify-ai-runtime.mjs`。

浏览器预览中的“AI 服务”现使用**可交互演示模式**，用于体验新增、编辑、启停、默认切换与删除服务的界面。演示状态仅在当前页面内存中保存，刷新后重置；不会接受或保存真实 API 密钥，不会执行连接测试、模型发现、真实判卷或上传任何训练资料。桌面模式与浏览器演示模式互相隔离。

## 本地运行

```bash
pnpm install
pnpm dev
```

上述命令仅启动浏览器预览，因而不会请求本地文件权限。若要运行桌面开发模式，请使用：

```bash
pnpm dev:desktop
```

首次为 Electron 构建 SQLite 原生绑定或更换 Electron 版本后，请运行：

```bash
pnpm rebuild:native
```

在 Apple Silicon Mac 上生成 DMG：

```bash
pnpm package:mac
```

## 后续桌面化路线

1. 将已确认的题目、小问和页内框选边界接入正式题库实体与训练题面。
2. 扩展 SQLite 迁移，落地评分依据、错因、报告与 IRT 实体。
3. 加入受限 IPC 的摄像头拍照与 macOS Keychain 密钥存储，并由用户主动触发 AI 请求。
4. 通过 `electron-builder --mac dmg --arm64` 生成 Apple Silicon DMG，并在未签名安装、签名和公证三个阶段分别验证。

## 质量基线

每个新功能需要包含键盘可达性、导入失败处理、AI 请求状态与撤销路径。所有本地文件操作必须在受限 IPC 层执行，渲染进程不得获得任意文件系统权限。
