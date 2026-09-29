# AI 服务安全配置

## 当前边界

My Euclid 的 AI 服务配置与题源、作答、SQLite 数据库和备份包完全分离。用户可在软件内新增、编辑、启停、删除并切换多个 OpenAI 兼容提供商；每条记录包含服务名称、HTTPS 基地址、模型标识、启用状态和密钥。完整提供商档案共同加密后写入应用私有目录下的 `secure/ai-provider-config.bin`；渲染进程只能读取脱敏摘要，绝不读取 API 密钥。备份机制仅包含 SQLite 与 `archive/`，因此不会包含该安全配置文件。该配置层有意限定为 macOS：非 macOS 环境即使 Electron 提供其他存储后端，也不会保存服务密钥。

默认提供商只能是已启用的服务。停用或删除默认服务时，系统会自动选择下一个可用服务；没有可用服务时不保留默认项。旧版本写入的单一提供商配置在首次读取时会识别为默认提供商，以避免既有配置丢失；首次后续保存会将它写为多提供商格式。

在 macOS 上，Electron `safeStorage` 使用 Keychain Access 保存应用的加密密钥；文档同时说明 `isEncryptionAvailable()` 仅在 Keychain 可用时返回真。[1]

> 当前版本已实现：安全配置、状态读取、移除、连接测试；逐次授权的 AI 判卷（先展示完整发送范围，用户确认后才请求，结果只写入待审核草案）；AI 互动讲解（先本地建立发送范围预览，确认后才请求）；AI 自动审核（OCR 校对 + 切分发布，**默认关闭**，需在审核工作台显式开启）；AI 变式出题与 AI 组卷（用户点击时发起）。保存配置本身不会上传任何资料；纸质附件、扫描图与笔迹二进制永远不出本机。每次判卷在 `ai_run_audits` 表留有审计记录。

## 本地验证

`scripts/verify-ai-config-security.mjs` 使用隔离目录和模拟加密器验证：非 macOS 拒绝保存密钥；旧单一配置可迁移；多提供商可新增、编辑、启停、设为默认和删除；密钥不出现在状态对象或加密文件明文中；备份 zip 不包含 `secure/` 路径或密钥内容。该测试验证应用的隔离与备份边界，不替代目标 Apple Silicon Mac 上的真实 Keychain 验证。

## 参考资料

[1]: https://www.electronjs.org/docs/latest/api/safe-storage "Electron safeStorage API"
