# My Euclid：Apple Silicon 实机验收记录

**验收日期：** 2026-08-27
**目标设备：** 用户的 Apple Silicon Mac  
**构建提交：** `5372882`（扩展 macOS 一键自动验收覆盖）

## 已通过的自动化实机验收

用户在目标 Mac 上执行 `scripts/verify-macos-arm64.sh`。脚本完成并输出 `PASS: arm64 build, core local regression, DMG layout, and integrity checks completed.`。这表示项目在真实 Apple Silicon 环境已完成依赖安装、原生依赖重建、构建、核心本地回归、互动讲解模拟链路、AI 草案/人工评分差异、确认评分报告隔离、备份恢复、arm64 DMG 生成、DMG 挂载布局检查和 `hdiutil verify` 完整性校验。

| 验收项 | 实际结果 | 证据 |
| --- | --- | --- |
| Apple Silicon 构建 | 通过 | 脚本在 arm64 前置检查后继续并输出最终 PASS |
| 核心本地回归 | 通过 | 最终 PASS 明确包含 core local regression |
| arm64 DMG | 通过 | 最终 PASS 明确包含 arm64 build 与 DMG layout |
| DMG 完整性 | 通过 | 最终 PASS 明确包含 integrity checks |
| 应用签名 | 通过（开发签名） | `Apple Development: df-dd2001@hotmail.com (4XRX3DHYQ6)`；含时间戳 |
| Hardened Runtime | 已启用 | `flags=0x10000(runtime)` |
| 首次窗口启动 | 通过 | 修复预加载、资源路径和 Hash 路由后，最新 DMG 在目标 Mac 首次直接进入工作台 |
| Agnes AI 连接/模型发现 | 通过 | 用户仅在目标 Mac 应用内填写密钥后，测试连接成功；密钥未通过聊天传递 |
| Keychain 持久化 | 通过 | 完整退出并重开应用后，Agnes AI 仍显示已配置且密钥不回显 |
| 互动讲解自动链路 | 通过 | 一键脚本包含逐次授权模拟、三方法计划、会话保存、追问和无效响应拒绝回归 |
| AI/人工评分差异 | 通过 | 一键脚本验证同答卷逐项引用与得分差异可保留，且 AI 草案不计入确认报告 |
| 本地备份恢复 | 通过 | 一键脚本覆盖评分报告备份、预检与恢复后的确认统计一致性 |

## 分发签名与公证状态

> Gatekeeper 对挂载 DMG 中的应用评估结果为 `rejected`。

这不是构建失败。实际输出证明应用目前使用的是 **Apple Development** 身份，而不是面向外部分发的 **Developer ID Application** 身份；同时没有完成 Apple 公证。因此该 DMG 可作为个人开发/测试构建，但尚不能声称为已公证的公开分发版本。完成公证需要由证书所有人使用 Apple Developer 凭据执行 Developer ID 签名和 notarization。

## 仍需由设备持有人完成的手动验收

最新 arm64 DMG 已在目标 Mac 从“应用程序”首次直接进入工作台；Keychain、模型发现与所有可自动覆盖的本地闭环已通过。真实 Agnes AI 的互动讲解和判卷请求仍保留逐次用户确认，不能也不应被自动脚本绕过。用户日后可在非敏感的已发布题目上自行确认一次真实请求，以完成体验级补充检查；不得在截图、日志或反馈中包含 API 密钥。
