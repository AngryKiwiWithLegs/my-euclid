# My Euclid：Agnes AI 本地配置

My Euclid 使用 OpenAI 兼容的 `/models` 和 `/chat/completions` 路径。Agnes AI 官方说明其接口兼容 OpenAI 风格，并给出统一的 v1 基地址和 Bearer 认证方式。[1] [2]

| My Euclid 字段 | 直接填写值 | 说明 |
| --- | --- | --- |
| 服务名称 | `Agnes AI` | 仅供本地识别，可自定义 |
| HTTPS API 基地址 | `https://apihub.agnes-ai.com/v1` | 不要附加 `/chat/completions` |
| 模型标识 | `agnes-2.5-flash` | 官方模型目录列出的文本/视觉模型；如模型发现结果不同，以账户实际返回为准 [3] |
| API 密钥 | 仅在本机粘贴你的 Agnes API Key | 不通过聊天、截图、日志或 Git 发送 |

在目标 Mac 已安装的 My Euclid 中，打开左侧 **AI 服务**，填写上表四项并保存。密钥应只由主进程在 macOS Keychain 可用时加密保存；保存后不要截取输入框。点击“测试连接/模型发现”时，应用会向 `GET /models` 发起请求；完成后再彻底退出并重开应用，以确认设置仍为“已配置”而密钥不回显。

> 互动讲解与 AI 判卷不会因为保存配置而自动发送内容。每一次实际调用前，My Euclid 仍会展示并要求确认发送范围；互动讲解只发送已发布题面的文本，不发送原件、扫描图、纸质附件或笔迹二进制。

如果模型发现失败，请先核对账户内 API Key 是否有效、基地址是否保持为上表的 v1 根路径，以及是否误把密钥粘贴进模型字段。不要将密钥粘贴到终端命令或对话窗口。

## References

[1] [Agnes AI API Overview](https://agnes-ai.com/doc)  
[2] [Agnes AI Quickstart](https://wiki.agnes-ai.com/en/docs/quickstart)  
[3] [Agnes AI Official Model Catalog](https://github.com/AgnesAI-Labs/AgnesAI-Models)
