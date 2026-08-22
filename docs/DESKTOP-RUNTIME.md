# Electron 本地运行时与安全边界

## 本轮目标

本轮将 My Euclid 的工作台迁入 Electron 桌面运行时。桌面层只负责本地文件选择、应用数据目录、SQLite、导入归档和受控的前端通信；题面、训练和报告继续由 React 渲染。对 AI 的调用将在后续作为单独的可审计能力接入，不在本轮自动上传任何资料。

## 进程职责

| 进程 | 权限 | 职责 |
| --- | --- | --- |
| Electron 主进程 | 文件系统、原生对话框、应用数据目录、SQLite | 创建窗口；选择文件；安全复制原件；创建与查询导入任务；导出数据库快照。 |
| 预加载脚本 | 固定、白名单化 IPC | 仅通过 `window.myEuclid` 暴露导入、任务查询和健康检查，不暴露 Node、`ipcRenderer` 或任意文件读写。 |
| React 渲染进程 | 仅限 DOM 与预加载 API | 发起用户操作、显示任务状态与审核界面；不直接读取路径、不持有数据库连接。 |

## 文件边界

用户选择的资料会复制到 `app.getPath('userData')/archive/originals`，以 UUID 命名，原始文件名和校验值保存到数据库。上传纸质答卷使用同一来源表，但额外记录 `source_kind = 'paper_response'` 与审核工作流状态。仅允许导入白名单格式：PDF、PNG、JPG、JPEG、HEIC、TXT 和 Markdown。文件大小、类型与读取失败都会返回显式错误，不静默跳过。

## 数据边界

数据库放在 `app.getPath('userData')/my-euclid.sqlite`。本轮创建 `source_documents`、`document_pages` 和 `import_jobs`，为后续题目、小问、作答、评分与 IRT 参数表预留外键路径。迁移以 `PRAGMA user_version` 顺序执行，不依赖远程服务。

## IPC 白名单

| 通道 | 方向 | 行为 |
| --- | --- | --- |
| `archive:select-and-import` | Renderer → Main | 打开原生文件选择框，验证并归档文件，创建导入任务。 |
| `archive:create-from-paths` | Renderer → Main | 仅接受主进程已通过对话框选择的文件路径；用于未来批量导入。 |
| `archive:list-import-jobs` | Renderer → Main | 返回最近的导入任务和安全的展示字段。 |
| `archive:get-health` | Renderer → Main | 返回数据库与归档目录状态，不返回敏感绝对路径。 |

预加载脚本对每个参数做运行时验证。所有读取、复制、数据库写入都在主进程中发生。Electron 窗口启用 `contextIsolation`、禁用 `nodeIntegration` 和 `enableRemoteModule`。
