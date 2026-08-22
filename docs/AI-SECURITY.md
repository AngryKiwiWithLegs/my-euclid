# AI 服务安全配置

## 当前边界

My Euclid 的 AI 服务配置与题源、作答、SQLite 数据库和备份包完全分离。服务名称、HTTPS 基地址和模型标识与 API 密钥共同加密后写入应用私有目录下的 `secure/ai-provider-config.bin`；渲染进程只能读取脱敏状态，绝不读取 API 密钥。备份机制仅包含 SQLite 与 `archive/`，因此不会包含该安全配置文件。该配置层有意限定为 macOS：非 macOS 环境即使 Electron 提供其他存储后端，也不会保存服务密钥。

在 macOS 上，Electron `safeStorage` 使用 Keychain Access 保存应用的加密密钥；文档同时说明 `isEncryptionAvailable()` 仅在 Keychain 可用时返回真。[1]

> 当前版本仅实现安全配置、状态读取与移除。它不发起网络评分请求，不会因保存配置自动上传题目、答卷、笔迹、附件或评分依据；真实判卷仍须由小明在未来版本中逐次主动授权。

## 本地验证

`scripts/verify-ai-config-security.mjs` 使用隔离目录和模拟加密器验证：密钥不出现在状态对象或加密文件明文中；备份 zip 不包含 `secure/` 路径或密钥内容；移除操作会清除配置文件。该测试验证应用的隔离与备份边界，不替代目标 Apple Silicon Mac 上的真实 Keychain 验证。

## 参考资料

[1]: https://www.electronjs.org/docs/latest/api/safe-storage "Electron safeStorage API"
