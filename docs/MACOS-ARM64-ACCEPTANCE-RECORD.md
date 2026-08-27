# My Euclid：Apple Silicon 实机验收记录

**验收日期：** 2026-08-26  
**目标设备：** 用户的 Apple Silicon Mac  
**构建提交：** `2eb766e`（修复 electron-builder 26 macOS schema）

## 已通过的自动化实机验收

用户在目标 Mac 上执行 `scripts/verify-macos-arm64.sh`。脚本完成并输出 `PASS: arm64 build, core local regression, DMG layout, and integrity checks completed.`。这表示项目在真实 Apple Silicon 环境已完成依赖安装、原生依赖重建、构建、核心本地回归、arm64 DMG 生成、DMG 挂载布局检查和 `hdiutil verify` 完整性校验。

| 验收项 | 实际结果 | 证据 |
| --- | --- | --- |
| Apple Silicon 构建 | 通过 | 脚本在 arm64 前置检查后继续并输出最终 PASS |
| 核心本地回归 | 通过 | 最终 PASS 明确包含 core local regression |
| arm64 DMG | 通过 | 最终 PASS 明确包含 arm64 build 与 DMG layout |
| DMG 完整性 | 通过 | 最终 PASS 明确包含 integrity checks |
| 应用签名 | 通过（开发签名） | `Apple Development: df-dd2001@hotmail.com (4XRX3DHYQ6)`；含时间戳 |
| Hardened Runtime | 已启用 | `flags=0x10000(runtime)` |

## 分发签名与公证状态

> Gatekeeper 对挂载 DMG 中的应用评估结果为 `rejected`。

这不是构建失败。实际输出证明应用目前使用的是 **Apple Development** 身份，而不是面向外部分发的 **Developer ID Application** 身份；同时没有完成 Apple 公证。因此该 DMG 可作为个人开发/测试构建，但尚不能声称为已公证的公开分发版本。完成公证需要由证书所有人使用 Apple Developer 凭据执行 Developer ID 签名和 notarization。

## 仍需由设备持有人完成的手动验收

请从 `release/` 打开最新 arm64 DMG，将 `My Euclid.app` 拖入“应用程序”后启动。随后在应用内手动确认 Keychain 配置保存、模型发现、逐次授权的互动讲解与 AI 判卷、AI 草案/人工评分差异面板，以及一份非敏感测试资料的备份恢复。不得在截图、日志或反馈中包含 API 密钥。
