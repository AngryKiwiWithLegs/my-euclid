# 开发说明

## 当前阶段

仓库现已包含 Electron 桌面壳、受限预加载 API、SQLite 本地数据库与真实资料归档的第一版实现。React 工作台中的“导入资料”和“上传纸质答卷”在 Electron 模式下会调用 macOS 原生文件选择器，将用户选择的文件复制到应用私有档案目录，并创建可持久化的审核任务。OCR、题号识别、摄像头、AI 判卷与 IRT 训练仍是后续功能，不会在本版本中被误表述为已完成。

页面级本地文本提取、图片 OCR、人工 OCR 修订以及题目/小问切分确认现已实现。扫描 PDF 的页面渲染和框选标注、摄像头拍摄、AI 判卷与 IRT 训练仍在后续范围内。

训练页现将键盘作答、手写板书说明与纸质答案附件保存为同一训练会话下的独立版本。桌面模式下，输入框失焦会写入草稿；“保存草稿”和“提交并分析”会分别创建可追溯的版本记录。纸质答案通过原生文件选择器导入并复制到私有档案目录。当前手写模式先保存板书说明；可绘制的数位板笔迹画布仍未实现。

本地备份入口会生成 `*.myeuclid-backup.zip`。备份含 SQLite 数据库、题源原件、答卷附件及带 SHA-256 的清单；恢复前必须完成文件路径和哈希预检。恢复采用覆盖替换策略，主进程会先创建当前档案的自动恢复点。端到端验证可运行：`pnpm build:electron && pnpm exec electron --runAsNode scripts/verify-practice-backup.mjs`。

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

1. 为已归档的 PDF/图片添加本地 OCR、页码预览、题目和小问审核界面。
2. 扩展 SQLite 迁移，落地题目、小问、作答、评分、错题和 IRT 实体。
3. 加入受限 IPC 的摄像头拍照、数据导出与 macOS Keychain 密钥存储。
4. 通过 `electron-builder --mac dmg --arm64` 生成 Apple Silicon DMG，并在未签名安装、签名和公证三个阶段分别验证。

## 质量基线

每个新功能需要包含键盘可达性、导入失败处理、AI 请求状态与撤销路径。所有本地文件操作必须在受限 IPC 层执行，渲染进程不得获得任意文件系统权限。
