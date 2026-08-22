# 数据模型

## 实体总览

| 实体 | 关键字段 | 说明 |
| --- | --- | --- |
| `SourceDocument` | `id`、`title`、`sourceType`、`originalPath`、`checksum` | 用户导入的原始 PDF、图片、文本或 URL 快照。 |
| `DocumentPage` | `sourceDocumentId`、`pageNumber`、`imagePath`、`ocrText` | 原件页面及 OCR 结果。 |
| `Contest` | `name`、`year`、`durationMinutes`、`rules` | 竞赛或练习资料的元信息。 |
| `Problem` | `contestId`、`number`、`renderedBody`、`sourceRegion` | 大题，指向原页坐标区域。 |
| `Subproblem` | `problemId`、`label`、`renderedBody`、`points`、`requiresProof` | 最小独立训练单元。 |
| `Tag` | `namespace`、`label`、`parentId` | 知识点、方法、错因、题型和状态等可扩展标签。 |
| `ProblemTag` | `subproblemId`、`tagId`、`confidence`、`reviewState` | AI 建议与人工审核的标签关联。 |
| `Attempt` | `subproblemId`、`mode`、`startedAt`、`submittedAt`、`durationSeconds` | 线上输入、手写或纸质上传的统一作答记录。 |
| `AttemptArtifact` | `attemptId`、`kind`、`path`、`order` | LaTeX、手写笔迹、图片、照片、标注等附件。 |
| `Assessment` | `attemptId`、`estimatedScore`、`rubricEvidence`、`mistakeTags` | AI 或人工产生的评分与依据。 |
| `Report` | `scope`、`score`、`moduleBreakdown`、`trendSnapshot` | 单题、整卷、阶段性与长期报告。 |
| `TrainingSession` | `goalTagId`、`strategy`、`status` | 标签训练、套卷、IRT 专项或错题复盘会话。 |
| `SkillEstimate` | `tagId`、`theta`、`confidence`、`updatedAt` | 用户在某知识节点上的能力估计。 |

## 纸质试卷映射

纸质整卷上传后创建一个 `AttemptBundle`（计划实体），其页面分别对应 `DocumentPage`，AI 识别的题号区域为 `AttemptArtifact`。审核完成后，每个区域生成或关联到一个 `Attempt`；因此纸质作答不会成为与在线作答平行的孤岛，而是同一数据链的一种入口。
