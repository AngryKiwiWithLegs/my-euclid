# My Euclid 规模与范围审计

**审计日期：** 2026-08-28  
**统计基线：** Git 跟踪树，稳定提交 `f0e13b6`；本轮新增文档和数据库修复另行说明。

## 统计口径

统计使用 `git ls-files`，因此不会把 `node_modules`、`dist`、临时数据库、用户资料、DMG 输出或本地日志误算进源代码。行数是物理行数，不等于有效语句数。字节数为 UTF-8 文件字节数。token 不是 Git 或 pnpm 能给出的精确值；这里按代码字节除以 3.5–4 个字符/token 给出工程估算，中文注释、长标识符、JSON 和 Markdown 会使真实 tokenizer 结果偏离。

## 文件与行数

| 类别 | 文件数 | 行数 | 字节数 | 说明 |
| --- | ---: | ---: | ---: | --- |
| Git 跟踪文件总计 | 162 | — | — | 含代码、脚本、文档、配置和补丁 |
| `electron/` | 11 | — | — | 主进程、预加载、数据库、AI、备份等 |
| `client/` | 94 | — | — | React 页面、组件、样式和 UI 原语 |
| `scripts/` | 21 | — | — | 构建、检查和离线回归脚本 |
| `docs/` | 17 | — | — | 统计基线尚未含本轮新增四份文档 |
| `shared/` | 1 | — | — | 共享常量/类型 |
| 产品代码 | 105 | 10,911 | 617,699 | `electron/client/shared` 的 TS/TSX/JS/MJS/CSS/HTML |
| 测试/验收脚本 | 19 | 688 | 58,597 | `scripts/` 中的 mjs/sh/py/ts |
| 文档 | 19 | 685 | 61,693 | `docs/*.md`、`README.md`、`todo.md` |
| 配置 | 8 | 10,699 | 383,698 | JSON/YAML/配置及 TypeScript 配置；包含较大的锁定/生成元数据 |

上述分类存在有意重叠，例如配置可能也被 Git 总数统计，但产品代码、测试、文档三项分别按扩展名和路径筛选。不要把四项简单相加作为“总代码量”。

## 代码量结论

如果“代码”只指运行时产品代码，当前基线约 **10,900 行**、**618 KB**。如果把离线验收脚本也计入工程实现，则约 **11,600 行**。如果将文档和配置也视为项目交付资产，则规模约 **23,000 行以上**，但这不是通常意义上的 LOC。

本轮新增四份交接文档会把文档行数和 Git 文件数增加；数据库修复只增加 2 行有效运行时代码：`mkdirSync` 导入和递归创建 `userData` 父目录。它不改变数据库文件名、迁移版本或 schema 语义。

## Token 估算

对 `electron/client/shared/scripts` 中 TypeScript、TSX、JavaScript、MJS、Shell 和 Python 文件的基线统计得到约 **614,722 bytes**。按简单字符密度估算：

| 估算口径 | 结果 |
| --- | ---: |
| 4 字符/token | 约 153,680 tokens |
| 3.5 字符/token | 约 175,635 tokens |
| 建议报告区间 | **约 150k–180k tokens** |

这个数字表示“把当前源代码一次性编码进上下文的大致输入规模”，不是开发过程实际消耗的模型 token，也不是账单数据。开发过程还包含多轮文件读取、错误日志、用户消息、工具返回、重试和压缩上下文，所以真实累计消化量必然更高；当前系统没有提供可验证的历史调用 token 账单，不能给出精确累计值。

若下一 AI 需要更精确的模型相关 token 数，应在本地安装与目标模型一致的 tokenizer 后，针对指定提交运行脚本，并把 tokenizer 名称、版本和输入文件清单写入报告；不能用本估算冒充精确值。

## GitHub 完整性结果

通过 GitHub CLI 审计得到：仓库 `dfdd2001-source/my-euclid` 存在且为 private，默认分支为 `main`；远端最新提交为 `f0e13b6 feat: add local archive status inspector`；远端递归 tree 包含 **162 个 blob 文件**。以下关键文件均存在：

```text
package.json
electron/database.ts
electron/main.ts
electron/preload.ts
client/src/pages/Home.tsx
scripts/verify-macos-arm64.sh
scripts/inspect-local-archive.mjs
docs/PRD.md
docs/ARCHITECTURE.md
todo.md
```

本地稳定 HEAD 与 GitHub `main` 在审计时一致。回滚后误触发 Web fullstack 升级产生的 `drizzle/` 未跟踪残留已经清理，没有进入 GitHub。当前本地尚有本轮有意修改：`electron/database.ts` 的两行首次运行目录修复，以及待提交的交接文档。

## 范围边界

包含范围是个人本地资料管理、OCR、题目切分、题库、模拟考试、键盘/手写/纸面作答、评分证据、报告、IRT、知识依赖、AI Provider 配置、按次授权的 AI 评分和 Tutor、备份恢复以及 arm64 DMG 构建。

不包含或尚未达到发行级的范围是多用户账户、云端同步、云数据库、在线商业化、自动批量上传用户资料、已公证的公开安装包和由当前沙箱直接读取目标 Mac userData。浏览器预览的 AI 配置是交互演示，不应计入真实 AI 网络验收。

## 建议的后续规模控制

后续开发应优先拆分过大的 `electron/database.ts` 和 `client/src/pages/Home.tsx`，按领域划分 archive、practice、assessment、adaptive、ai、backup 模块；每次只扩展一个协议面，并同步类型、测试、文档和 todo。不要通过引入 Web fullstack 模板解决桌面本地问题，也不要在没有真实需求的情况下继续增加依赖。
