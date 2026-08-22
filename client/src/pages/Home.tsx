/**
 * 欧几里得档案室：新古典编辑主义工作台。
 * 题面与证据优先，使用温暖档案纸、深海军蓝和朱砂红建立克制层次。
 */
import { useMemo, useState } from "react";
import {
  Archive,
  ArrowUpRight,
  BookOpenCheck,
  BrainCircuit,
  ChevronDown,
  Clock3,
  FileUp,
  GraduationCap,
  LibraryBig,
  MoreHorizontal,
  PenLine,
  ScanLine,
  Sparkles,
  Target,
  TimerReset,
  Upload,
} from "lucide-react";

const navItems = [
  { label: "工作台", icon: Archive },
  { label: "题库档案", icon: LibraryBig },
  { label: "训练会话", icon: Target },
  { label: "错题证据", icon: BookOpenCheck },
  { label: "报告与轨迹", icon: BrainCircuit },
];

const importOptions = [
  { label: "导入资料", detail: "PDF · 图片 · 文本", icon: FileUp },
  { label: "上传纸质答卷", detail: "扫描件 · 拍照", icon: ScanLine },
  { label: "新建在线作答", detail: "LaTeX · 手写", icon: PenLine },
];

const activeTasks = [
  { id: "E-2025-07(b)", title: "Euclid 2025 · 第 7 题 (b)", tags: ["数列", "递推", "证明"], time: "预计 18 分钟", state: "待作答", tone: "navy" },
  { id: "POTM-26-04", title: "Problem of the Month · April", tags: ["计数", "不变量"], time: "深度专项 · 3 阶", state: "继续训练", tone: "vermilion" },
  { id: "E-2024-10", title: "Euclid 2024 · 第 10 题", tags: ["几何", "构造", "高难"], time: "上次作答 2026/08/20", state: "查看证据", tone: "graphite" },
];

const evidence = [
  { kind: "OCR", text: "2026 Euclid 试卷已识别：10 道大题、27 个小问。", accent: "#163A5F" },
  { kind: "标签", text: "12 个 AI 标签等待审核；3 个标签置信度低于 0.70。", accent: "#A94132" },
  { kind: "归档", text: "原始资料完整保留；最近一次备份尚未创建。", accent: "#607073" },
];

function SideNav({ active, onChange }: { active: string; onChange: (item: string) => void }) {
  return (
    <aside className="sidebar">
      <div className="brand-lockup">
        <img src="/manus-storage/euclid-archive-logo_98b594c5.png" alt="My Euclid 抽象作图标志" className="brand-mark" />
        <div>
          <p className="brand-kicker">PERSONAL MATH ARCHIVE</p>
          <h1>My Euclid</h1>
        </div>
      </div>

      <nav aria-label="主导航" className="primary-nav">
        {navItems.map(({ label, icon: Icon }) => (
          <button key={label} className={`nav-item ${active === label ? "is-active" : ""}`} onClick={() => onChange(label)}>
            <Icon size={18} strokeWidth={1.7} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-foot">
        <div className="local-status"><span /> 本地档案模式</div>
        <p>资料、作答与报告默认仅保存在本机。AI 请求需由你主动发起。</p>
      </div>
    </aside>
  );
}

function Metric({ number, label, note }: { number: string; label: string; note: string }) {
  return (
    <div className="metric">
      <strong>{number}</strong>
      <span>{label}</span>
      <small>{note}</small>
    </div>
  );
}

export default function Home() {
  const [active, setActive] = useState("工作台");
  const [toast, setToast] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const today = useMemo(() => new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(new Date()), []);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2800);
  };

  return (
    <div className="archive-app">
      <SideNav active={active} onChange={(item) => { setActive(item); notify(`${item}模块正在准备中`); }} />

      <main className="workbench">
        <header className="topbar">
          <div className="crumb"><span>档案工作台</span><i /> <span>{active}</span></div>
          <div className="top-actions">
            <button className="quiet-button" onClick={() => notify("已打开本地备份设置")}>本地备份 <ArrowUpRight size={15} /></button>
            <button className="profile-chip" onClick={() => notify("个人档案设置将在后续版本开放")}><span>明</span><ChevronDown size={14} /></button>
          </div>
        </header>

        <section className="intro-row">
          <div className="intro-copy">
            <p className="eyebrow">{today} · EVIDENCE-LED PRACTICE</p>
            <h2>从证据出发，<em>定位下一处突破。</em></h2>
            <p>把原始试卷、在线推演与纸质答案放进同一套训练档案。今天先处理待审核资料，再从当前最薄弱的节点开始。</p>
          </div>
          <div className="paper-hero" aria-label="数学档案材料装饰图" />
        </section>

        <section className="metric-strip" aria-label="训练概览">
          <Metric number="0" label="已归档小问" note="导入资料后开始建立索引" />
          <Metric number="—" label="当前能力估计" note="需要真实作答后计算" />
          <Metric number="0 h" label="本周专注训练" note="计时会话将显示在这里" />
          <Metric number="待定" label="首份模考报告" note="完成一次 150 分钟套卷后生成" />
        </section>

        <section className="split-layout">
          <div className="main-column">
            <div className="section-heading">
              <div><p className="eyebrow">FIRST ACTION</p><h3>建立你的第一份训练档案</h3></div>
              <button className="text-action" onClick={() => notify("导入向导将在桌面客户端版本中连接本地文件系统")}>查看导入规范 <ArrowUpRight size={15} /></button>
            </div>

            <div className="import-grid">
              {importOptions.map(({ label, detail, icon: Icon }) => (
                <button key={label} className="import-card" onClick={() => notify(`${label}：已记录为下一步实现入口`)}>
                  <span className="import-icon"><Icon size={21} strokeWidth={1.6} /></span>
                  <span><strong>{label}</strong><small>{detail}</small></span>
                  <ArrowUpRight size={16} />
                </button>
              ))}
            </div>

            <div className="section-heading task-heading">
              <div><p className="eyebrow">CURATED QUEUE</p><h3>训练队列</h3></div>
              <div className="queue-filter"><Clock3 size={15} /> 待导入资料后生成</div>
            </div>
            <div className="task-list">
              {activeTasks.map((task, index) => (
                <article key={task.id} className="task-row">
                  <span className={`index-bar ${task.tone}`} />
                  <div className="task-index">0{index + 1}</div>
                  <div className="task-content"><p>{task.id}</p><h4>{task.title}</h4><div>{task.tags.map(tag => <span className="tag" key={tag}>{tag}</span>)}</div></div>
                  <div className="task-time"><TimerReset size={15} /><span>{task.time}</span></div>
                  <button className="start-button" onClick={() => notify("样例队列仅用于界面演示；导入真实资料后将替换")}>{task.state}</button>
                  <button className="more-button" aria-label={`${task.title}更多选项`} onClick={() => notify("更多操作将在训练会话中提供")}><MoreHorizontal size={19} /></button>
                </article>
              ))}
            </div>
          </div>

          {drawerOpen && <aside className="evidence-drawer">
            <div className="drawer-head"><div><p className="eyebrow">TRACEABILITY</p><h3>档案证据</h3></div><button aria-label="收起证据抽屉" onClick={() => setDrawerOpen(false)}>×</button></div>
            <div className="evidence-list">
              {evidence.map(item => <article className="evidence-item" key={item.kind}><span style={{ background: item.accent }} /><div><p>{item.kind}</p><small>{item.text}</small></div></article>)}
            </div>
            <div className="ai-note"><Sparkles size={18} /><div><strong>AI 仅在你发起后工作</strong><p>OCR、切分、评分和讲解均保留审核依据。</p></div></div>
            <button className="outline-button" onClick={() => notify("导入导出规范已写入项目文档")}>查看数据迁移规范 <ArrowUpRight size={15} /></button>
          </aside>}
        </section>

        {!drawerOpen && <button className="reopen-drawer" onClick={() => setDrawerOpen(true)}><BookOpenCheck size={17} /> 打开档案证据</button>}
      </main>
      {toast && <div className="toast" role="status"><GraduationCap size={17} /> {toast}</div>}
    </div>
  );
}
