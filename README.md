# My Euclid

**My Euclid** 是一个面向个人使用的 macOS 欧几里得数学竞赛备考客户端。它将本地持有的题目资料转化为可追溯、可切分、可标注、可训练的数据集，并将线上作答与纸质答卷上传放入同一套评分、分析和复盘闭环。

> 当前仓库已提供 **Electron 桌面壳、SQLite 本地归档与 React 工作台**。桌面模式已接入资料选择、原件复制归档、文本层提取、图片 OCR、扫描 PDF 页图渲染、人工审核、区域框选与局部 OCR；自动切分建议、AI 判卷和 IRT 训练仍将在后续迭代接入。

## 已确认的产品能力

| 范畴 | 能力 |
| --- | --- |
| **题源** | 拖拽导入 PDF、扫描 PDF、图片、文本；导入文件夹；由 URL 导入。原件永久本地保留，并和切分结果建立页码与区域回链。 |
| **重构** | 云端 AI 在用户主动启用后执行 OCR，建议“大题—小问”边界与多维标签；用户可审核、批量修改、撤销。 |
| **作答** | 支持键盘 LaTeX、手写板书、纸质答案拍照或扫描上传；同一题目下多次、多形态作答按时间线共存。 |
| **训练** | 单题训练、标签筛选、深度专项、严格 2.5 小时 Euclid 全真模考。 |
| **反馈** | AI 预估评分、得分点与依据、错因分析、三种以上解法、同类题关联、变式追问、全景答卷报告。 |
| **分析** | 题型与模块统计、能力雷达、长期进步曲线、IRT 驱动的知识依赖与自适应训练。 |
| **迁移** | 导入/导出题库、标签、训练历史、报告、附件索引和用户本地配置。 |

## 文档

| 文档 | 内容 |
| --- | --- |
| [产品规格书](./docs/PRD.md) | 目标、功能边界、用户流程与验收标准。 |
| [系统架构](./docs/ARCHITECTURE.md) | Electron、React、本地数据库、AI 调用和安全边界。 |
| [数据模型](./docs/DATA-MODEL.md) | 题源、题目、小问、作答、评分、标签与 IRT 实体关系。 |
| [导入导出规范](./docs/IMPORT-EXPORT.md) | 本地文件、URL、纸质答卷与备份归档格式。 |
| [OCR 与审核工作流](./docs/OCR-REVIEW.md) | PDF/图片页面预览、局部 OCR 审计、人工文本修订与题目小问切分确认。 |
| [统一作答与本地迁移](./docs/LOCAL-MIGRATION.md) | 作答版本、答案附件、备份包、预检和恢复边界。 |
| [笔迹作答与回放](./docs/INK-CANVAS.md) | 图层、笔画、SVG 快照、回放和本地备份恢复。 |
| [可审计评分与报告](./docs/ASSESSMENT-REPORT.md) | 本地评分、评分依据、错因、模块拆分、报告聚合及 AI 接入边界。 |
| [AI 服务安全配置](./docs/AI-SECURITY.md) | macOS Keychain 密钥隔离、脱敏状态、备份排除和主动授权边界。 |
| [逐次授权的 AI 判卷](./docs/AI-ASSESSMENT.md) | 模型发现、发送范围核对、一次性授权、结构化评分草案与本地审计。 |
| [开发说明](./docs/DEVELOPMENT.md) | 当前原型的运行方式和后续 DMG 打包路线。 |

## 运行当前版本

```bash
pnpm install
pnpm dev
```

浏览器打开开发服务地址即可查看“欧几里得档案室”工作台预览。浏览器预览不会接触本地资料；要验证真实本地归档，请使用 `pnpm dev:desktop` 启动 Electron。

本地回归验证会覆盖归档、PDF/图片 OCR、扫描 PDF 页图渲染、区域 OCR、笔迹与备份恢复。构建桌面端后，可运行 `pnpm exec electron --runAsNode scripts/verify-region-ocr.mjs /tmp/euclid-region-ocr-scan-sample.pdf` 验证区域 OCR；PDF 夹具可由 `manus-md-to-pdf scripts/fixtures/region-ocr-scan-sample.md /tmp/euclid-region-ocr-scan-sample.pdf` 生成。

## 隐私与资料边界

My Euclid 是个人本地工具。题库文件、题目切分、作答、报告与训练记录默认保留在本地。只有在用户主动点击 OCR、AI 评分、讲解或生成变式时，当前任务所必需的材料才会发送给用户配置的 AI 服务。产品不公开分发用户导入的资料。
