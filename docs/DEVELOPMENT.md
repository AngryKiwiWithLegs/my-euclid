# 开发说明

## 当前阶段

仓库目前包含 React 工作台原型，用于固定交互信息架构与视觉语言。它还不是完整的 Electron 应用，不会在此阶段假装实现本地 SQLite、摄像头、OCR 或 AI 判卷。

## 本地运行

```bash
pnpm install
pnpm dev
```

## 后续桌面化路线

1. 将当前 React 应用迁入 Electron 主进程与预加载脚本架构。
2. 在 Electron 主进程实现受限 IPC：文件选择、受控文件读写、摄像头、Keychain 和导入导出。
3. 引入 SQLite 与迁移文件，实现文档、题目、作答、评分与 IRT 数据结构。
4. 通过 `electron-builder --mac dmg --arm64` 生成 Apple Silicon DMG，并在未签名安装、签名和公证三个阶段分别验证。

## 质量基线

每个新功能需要包含键盘可达性、导入失败处理、AI 请求状态与撤销路径。所有本地文件操作必须在受限 IPC 层执行，渲染进程不得获得任意文件系统权限。
