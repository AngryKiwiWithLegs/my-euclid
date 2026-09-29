/** 首页仪表盘：导入入口与演示训练队列（示例数据，不计入统计）。 */
import { useMemo } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Download,
  FileUp,
  PenLine,
  ScanLine,
  Sparkles,
  TimerReset,
} from "lucide-react";
import { demoTasks } from "@/lib/demoQuestions";
import type { ImportKind } from "@/lib/views";
import { Metric, SectionTitle } from "./shared";

export function Dashboard({
  openImport,
  openTraining,
  importedCount,
}: {
  openImport: (kind: Exclude<ImportKind, null>) => void;
  openTraining: (id?: string) => void;
  importedCount: number;
}) {
  const today = useMemo(
    () =>
      new Intl.DateTimeFormat("zh-CN", {
        month: "long",
        day: "numeric",
        weekday: "long",
      }).format(new Date()),
    []
  );
  return (
    <>
      <section className="intro-row">
        <div className="intro-copy">
          <p className="eyebrow">{today} · EVIDENCE-LED PRACTICE</p>
          <h2>
            从证据出发，<em>定位下一处突破。</em>
          </h2>
          <p>
            把原始试卷、在线推演与纸质答案放进同一套训练档案。导入第一份资料后，系统会建立可审核的题目索引。
          </p>
        </div>
        <div className="paper-hero" aria-label="数学档案材料装饰图" />
      </section>
      <section className="metric-strip" aria-label="训练概览">
        <Metric
          number={String(importedCount)}
          label="已归档资料"
          note={
            importedCount ? "已写入本地 SQLite 档案" : "导入资料后开始建立索引"
          }
        />
        <Metric number="—" label="当前能力估计" note="需要真实作答后计算" />
        <Metric number="0 h" label="本周专注训练" note="计时会话将显示在这里" />
        <Metric
          number="待定"
          label="首份模考报告"
          note="完成一次 150 分钟套卷后生成"
        />
      </section>
      <section className="split-layout">
        <div className="main-column">
          <SectionTitle
            eyebrow="FIRST ACTION"
            title="建立你的第一份训练档案"
            action={
              <span className="subtle-caption">
                全部入口均可在当前原型中试用
              </span>
            }
          />
          <div className="import-grid">
            <button
              className="import-card"
              onClick={() => openImport("source")}
            >
              <span className="import-icon">
                <FileUp size={21} />
              </span>
              <span>
                <strong>导入资料</strong>
                <small>PDF · 图片 · 文本</small>
              </span>
              <ArrowUpRight size={16} />
            </button>
            <button className="import-card" onClick={() => openImport("paper")}>
              <span className="import-icon">
                <ScanLine size={21} />
              </span>
              <span>
                <strong>上传纸质答卷</strong>
                <small>扫描件 · 拍照 · 整套试卷</small>
              </span>
              <ArrowUpRight size={16} />
            </button>
            <button
              className="import-card"
              onClick={() => openImport("answer")}
            >
              <span className="import-icon">
                <PenLine size={21} />
              </span>
              <span>
                <strong>新建在线作答</strong>
                <small>LaTeX · 手写 · 画图</small>
              </span>
              <ArrowUpRight size={16} />
            </button>
          </div>
          <SectionTitle
            eyebrow="CURATED QUEUE"
            title="训练队列"
            action={
              <span className="queue-filter">
                <Clock3 size={15} /> 示例队列 · 不计入数据
              </span>
            }
          />
          <div className="task-list">
            {demoTasks.map((task, index) => (
              <article key={task.id} className="task-row">
                <span
                  className={`index-bar ${index === 1 ? "vermilion" : index === 2 ? "graphite" : "navy"}`}
                />
                <div className="task-index">0{index + 1}</div>
                <div className="task-content">
                  <p>
                    {task.source} · {task.number}
                  </p>
                  <h4>{task.title}</h4>
                  <div>
                    {task.tags.map(tag => (
                      <span className="tag" key={tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="task-time">
                  <TimerReset size={15} />
                  <span>
                    {task.difficulty} · {task.points} 分
                  </span>
                </div>
                <button
                  className="start-button"
                  onClick={() => openTraining(task.id)}
                >
                  {task.status === "待复盘" ? "查看证据" : "进入训练"}
                </button>
              </article>
            ))}
          </div>
        </div>
        <EvidenceDrawer />
      </section>
    </>
  );
}

function EvidenceDrawer() {
  return (
    <aside className="evidence-drawer">
      <div className="drawer-head">
        <div>
          <p className="eyebrow">TRACEABILITY</p>
          <h3>档案证据</h3>
        </div>
      </div>
      <div className="evidence-list">
        <article className="evidence-item">
          <span className="navy-accent" />
          <div>
            <p>OCR</p>
            <small>导入后会显示页面、识别文本与小问边界。</small>
          </div>
        </article>
        <article className="evidence-item">
          <span className="red-accent" />
          <div>
            <p>标签</p>
            <small>AI 建议与人工审核状态会并存、可回退。</small>
          </div>
        </article>
        <article className="evidence-item">
          <span className="graphite-accent" />
          <div>
            <p>归档</p>
            <small>原始资料始终可由题目和报告回链查看。</small>
          </div>
        </article>
      </div>
      <div className="ai-note">
        <Sparkles size={18} />
        <div>
          <strong>AI 仅在你发起后工作</strong>
          <p>OCR、切分、评分和讲解均保留审核依据。</p>
        </div>
      </div>
      <button className="outline-button">
        <Download size={15} /> 查看数据迁移规范
      </button>
    </aside>
  );
}
