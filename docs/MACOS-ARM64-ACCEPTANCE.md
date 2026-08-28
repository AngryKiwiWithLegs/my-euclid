# My Euclid：Apple Silicon 实机验收

本说明用于**Apple Silicon（arm64）Mac**。由于当前只连接了文件夹而没有远程终端控制，构建、安装与 Keychain 验证须由设备持有人在 macOS“终端”执行；脚本不会读取、打印、上传或导出任何 API 密钥。

## 1. 获取项目并运行一键检查

在“终端”依次执行以下命令。若项目已经存在，只需进入项目目录并执行第二条命令。

```bash
git clone https://github.com/dfdd2001-source/my-euclid.git "$HOME/Documents/My Euclid/my-euclid"
cd "$HOME/Documents/My Euclid/my-euclid"
bash scripts/verify-macos-arm64.sh
```

脚本会核对 `arm64` 架构、安装锁定依赖、重建 `better-sqlite3` 原生模块、运行构建和核心本地回归、制作 arm64 DMG，并验证 DMG 可挂载、其中含有 `My Euclid.app`。输出被写入 `macos-arm64-acceptance.log`；此日志不应包含 API 密钥。请将该日志内容（如有敏感文件路径可先删除）发回用于记录验收。

> 如果终端提示 `pnpm` 不存在，请先安装 Node.js 的长期支持版本和 pnpm，再重新运行；不要用系统权限绕过安装或关闭 macOS 安全保护。

## 2. 手动桌面端检查

在同一项目目录运行 `pnpm dev:desktop`。应用打开后，使用一份非敏感的测试资料完成以下操作：导入一页资料、核对 OCR/框选、创建笔迹和纸质附件作答、保存并恢复一个测试备份。此处重点验证真实 GUI、SQLite 原生模块、文件权限和恢复流程。

接着在“AI 服务”中手动新增你自己的 OpenAI 兼容提供商。确认密钥输入后不回显；测试模型发现；选一个已发布题目，先查看互动讲解的发送范围，再确认生成三种方法并发起一次追问；最后为同一答卷保留 AI 草案和人工确认评分，检查逐项差异面板且确认只有人工确认记录进入报告。不要把密钥、模型访问令牌或截图中的密钥提供给任何人。

| 验收点 | 通过标准 | 记录方式 |
| --- | --- | --- |
| Keychain | 配置保存后重启应用仍可显示“已配置”，但密钥不回显 | 仅记录成功/失败 |
| 真实服务 | 模型发现、授权预览、讲解与判卷均由手动确认触发 | 记录服务名称，不记录密钥 |
| 本地恢复 | 备份预检与恢复完成，附件/评分档案仍可回看 | 记录通过/失败原因 |
| 差异审核 | 同一答卷的 AI 草案与人工评分可逐项比较 | 截图可遮盖题面与路径 |

## 3. 安装 arm64 DMG 与签名状态

执行脚本后，DMG 位于 `release/`。双击打开，将 `My Euclid.app` 拖入“应用程序”，然后从“应用程序”启动。脚本的 `codesign` 和 `spctl` 输出会记录为以下三种之一：已签名且可评估、已签名但未公证、未签名。当前仓库未配置 Apple Developer 签名身份或公证凭据，因此**可构建的 arm64 DMG 不等同于已签名/已公证发布版本**。

安装完成后，如果不想在 Finder 中寻找应用，可以在项目根目录执行一键启动脚本：

```bash
bash scripts/open-latest-macos-build.sh
```

脚本按以下顺序处理：优先打开已安装的 `/Applications/My Euclid.app`；若应用尚未安装，则打开仓库 `release/` 下找到的最新 `.app`；如果只有 DMG，则打开最新 `.dmg` 供安装。脚本只调用 macOS `open`，不会读取 userData、Keychain、题面、答卷或 API key。

如需让验证脚本从只读 DMG 内启动应用以核对首次启动，可改用：

```bash
bash scripts/verify-macos-arm64.sh --open-dmg
```

当 macOS 出现 Gatekeeper 提示时，先不要关闭系统保护或使用未知命令。记录提示内容并发回即可；后续签名与公证必须使用属于你的 Apple Developer 凭据。
