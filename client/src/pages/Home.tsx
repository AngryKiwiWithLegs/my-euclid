/**
 * 欧几里得档案室：新古典编辑主义工作台。
 * 题面与证据优先，使用温暖档案纸、深海军蓝和朱砂红建立克制层次。
 */
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { InkCanvas } from "@/components/InkCanvas";
import { OcrRegionSelector } from "@/components/OcrRegionSelector";
import { EvidenceWorkspace, ReportsWorkspace } from "@/components/AssessmentWorkspace";
import {
  Archive,
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  BookOpenCheck,
  BrainCircuit,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Download,
  FileText,
  FileUp,
  FileSearch,
  Filter,
  FolderOpen,
  GraduationCap,
  ImageUp,
  Keyboard,
  LibraryBig,
  Lightbulb,
  Link,
  MoreHorizontal,
  MousePointer2,
  NotebookPen,
  PenLine,
  Play,
  ScanLine,
  Search,
  Save,
  Send,
  Sparkles,
  Target,
  TimerReset,
  Undo2,
  Upload,
  Plus,
  Trash2,
  X,
} from "lucide-react";

type View = "工作台" | "题库档案" | "审核工作台" | "训练会话" | "错题证据" | "报告与轨迹";
type ImportKind = "source" | "paper" | "answer" | null;

const navItems: { label: View; icon: typeof Archive }[] = [
  { label: "工作台", icon: Archive },
  { label: "题库档案", icon: LibraryBig },
  { label: "审核工作台", icon: FileSearch },
  { label: "训练会话", icon: Target },
  { label: "错题证据", icon: BookOpenCheck },
  { label: "报告与轨迹", icon: BrainCircuit },
];

const questions = [
  { id: "E-2025-07b", source: "Euclid 2025", number: "第 7 题 (b)", title: "递推中的不变量", text: "设数列由给定递推式定义。证明所求表达式对所有正整数 n 均成立。", tags: ["数列", "递推", "证明"], difficulty: "中高", points: 4, status: "待作答" },
  { id: "POTM-26-04", source: "Problem of the Month", number: "April", title: "计数与不变量", text: "在满足给定约束的构造中，找出一个在操作下保持不变的量，并据此完成计数。", tags: ["计数", "不变量"], difficulty: "高", points: 10, status: "专项中" },
  { id: "E-2024-10", source: "Euclid 2024", number: "第 10 题", title: "几何构造的存在性", text: "在给定几何条件下证明所需构造存在，并说明其关键性质。", tags: ["几何", "构造", "高难"], difficulty: "最高", points: 10, status: "待复盘" },
];

const evidenceItems = [
  { id: "miss-01", title: "Euclid 2024 · 第 10 题", subtitle: "几何构造的存在性", score: "4 / 10", reason: "存在性论证缺少闭合步骤", tag: "步骤跳跃", state: "待讲解" },
  { id: "miss-02", title: "POTM · April", subtitle: "计数与不变量", score: "—", reason: "已停在不变量选择阶段", tag: "思路卡壳", state: "待重试" },
  { id: "miss-03", title: "Euclid 2025 · 第 7 题 (b)", subtitle: "递推中的不变量", score: "—", reason: "尚未提交第一版证明", tag: "待作答", state: "训练中" },
];

function SideNav({ active, onChange }: { active: View; onChange: (item: View) => void }) {
  return <aside className="sidebar">
    <div className="brand-lockup"><img src="/manus-storage/euclid-archive-logo_98b594c5.png" alt="My Euclid 抽象作图标志" className="brand-mark" /><div><p className="brand-kicker">PERSONAL MATH ARCHIVE</p><h1>My Euclid</h1></div></div>
    <nav aria-label="主导航" className="primary-nav">{navItems.map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${active === label ? "is-active" : ""}`} onClick={() => onChange(label)}><Icon size={18} strokeWidth={1.7} /><span>{label}</span></button>)}</nav>
    <div className="sidebar-foot"><div className="local-status"><span /> 本地档案模式</div><p>资料、作答与报告默认保存在本机。AI 请求由你主动发起。</p></div>
  </aside>;
}

function SectionTitle({ eyebrow, title, action }: { eyebrow: string; title: string; action?: React.ReactNode }) {
  return <div className="section-heading"><div><p className="eyebrow">{eyebrow}</p><h3>{title}</h3></div>{action}</div>;
}

function Metric({ number, label, note }: { number: string; label: string; note: string }) {
  return <div className="metric"><strong>{number}</strong><span>{label}</span><small>{note}</small></div>;
}

function Dashboard({ openImport, openTraining, importedCount }: { openImport: (kind: ImportKind) => void; openTraining: (id?: string) => void; importedCount: number }) {
  const today = useMemo(() => new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(new Date()), []);
  return <>
    <section className="intro-row"><div className="intro-copy"><p className="eyebrow">{today} · EVIDENCE-LED PRACTICE</p><h2>从证据出发，<em>定位下一处突破。</em></h2><p>把原始试卷、在线推演与纸质答案放进同一套训练档案。导入第一份资料后，系统会建立可审核的题目索引。</p></div><div className="paper-hero" aria-label="数学档案材料装饰图" /></section>
    <section className="metric-strip" aria-label="训练概览"><Metric number={String(importedCount)} label="已归档资料" note={importedCount ? "已写入本地 SQLite 档案" : "导入资料后开始建立索引"} /><Metric number="—" label="当前能力估计" note="需要真实作答后计算" /><Metric number="0 h" label="本周专注训练" note="计时会话将显示在这里" /><Metric number="待定" label="首份模考报告" note="完成一次 150 分钟套卷后生成" /></section>
    <section className="split-layout"><div className="main-column"><SectionTitle eyebrow="FIRST ACTION" title="建立你的第一份训练档案" action={<span className="subtle-caption">全部入口均可在当前原型中试用</span>} />
      <div className="import-grid">
        <button className="import-card" onClick={() => openImport("source")}><span className="import-icon"><FileUp size={21} /></span><span><strong>导入资料</strong><small>PDF · 图片 · 文本 · 链接</small></span><ArrowUpRight size={16} /></button>
        <button className="import-card" onClick={() => openImport("paper")}><span className="import-icon"><ScanLine size={21} /></span><span><strong>上传纸质答卷</strong><small>扫描件 · 拍照 · 整套试卷</small></span><ArrowUpRight size={16} /></button>
        <button className="import-card" onClick={() => openImport("answer")}><span className="import-icon"><PenLine size={21} /></span><span><strong>新建在线作答</strong><small>LaTeX · 手写 · 画图</small></span><ArrowUpRight size={16} /></button>
      </div>
      <SectionTitle eyebrow="CURATED QUEUE" title="训练队列" action={<span className="queue-filter"><Clock3 size={15} /> 示例队列 · 不计入数据</span>} />
      <div className="task-list">{questions.map((task, index) => <article key={task.id} className="task-row"><span className={`index-bar ${index === 1 ? "vermilion" : index === 2 ? "graphite" : "navy"}`} /><div className="task-index">0{index + 1}</div><div className="task-content"><p>{task.source} · {task.number}</p><h4>{task.title}</h4><div>{task.tags.map(tag => <span className="tag" key={tag}>{tag}</span>)}</div></div><div className="task-time"><TimerReset size={15} /><span>{task.difficulty} · {task.points} 分</span></div><button className="start-button" onClick={() => openTraining(task.id)}>{task.status === "待复盘" ? "查看证据" : "进入训练"}</button><button className="more-button" aria-label="更多选项"><MoreHorizontal size={19} /></button></article>)}</div>
    </div><EvidenceDrawer /></section>
  </>;
}

function EvidenceDrawer() {
  return <aside className="evidence-drawer"><div className="drawer-head"><div><p className="eyebrow">TRACEABILITY</p><h3>档案证据</h3></div></div><div className="evidence-list"><article className="evidence-item"><span className="navy-accent" /><div><p>OCR</p><small>导入后会显示页面、识别文本与小问边界。</small></div></article><article className="evidence-item"><span className="red-accent" /><div><p>标签</p><small>AI 建议与人工审核状态会并存、可回退。</small></div></article><article className="evidence-item"><span className="graphite-accent" /><div><p>归档</p><small>原始资料始终可由题目和报告回链查看。</small></div></article></div><div className="ai-note"><Sparkles size={18} /><div><strong>AI 仅在你发起后工作</strong><p>OCR、切分、评分和讲解均保留审核依据。</p></div></div><button className="outline-button"><Download size={15} /> 查看数据迁移规范</button></aside>;
}

function LibraryView({ openImport, openTraining, importJobs, openReview }: { openImport: (kind: ImportKind) => void; openTraining: (id: string) => void; importJobs: MyEuclidImportJob[]; openReview: () => void }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("全部模块");
  const filtered = questions.filter(q => `${q.source}${q.title}${q.tags.join("")}`.toLowerCase().includes(query.toLowerCase()) && (filter === "全部模块" || q.tags.includes(filter)));
  return <div className="view-shell"><SectionTitle eyebrow="SOURCE INDEX" title="题库档案" action={<div className="inline-actions"><button className="text-action" onClick={() => openImport("source")}><Upload size={15} /> 导入资料</button><button className="text-action" onClick={() => openImport("paper")}><Camera size={15} /> 上传答卷</button></div>} />
    <div className="library-toolbar"><label className="search-box"><Search size={16} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="搜索题号、来源、知识点" /></label><label className="filter-select"><Filter size={15} /><select value={filter} onChange={e => setFilter(e.target.value)}><option>全部模块</option><option>数列</option><option>计数</option><option>几何</option></select></label><span className="result-count">{filtered.length} 个示例条目</span></div>
    <div className="library-table"><div className="table-head"><span>来源 / 小问</span><span>标签</span><span>难度</span><span>状态</span><span /></div>{filtered.map(q => <article className="library-row" key={q.id}><div><p className="record-id">{q.id}</p><h4>{q.source} · {q.number}</h4><small>{q.title}</small></div><div>{q.tags.map(tag => <span className="tag" key={tag}>{tag}</span>)}</div><span className="difficulty-dot"><i />{q.difficulty}</span><span className="status-pill">{q.status}</span><button className="row-action" onClick={() => openTraining(q.id)}>打开 <ChevronRight size={15} /></button></article>)}</div>
    {importJobs.length > 0 && <section className="import-ledger"><SectionTitle eyebrow="LOCAL IMPORT LEDGER" title="已归档的真实资料" action={<button className="text-action" onClick={openReview}><FileSearch size={15} /> 打开审核工作台</button>} /><div className="import-job-list">{importJobs.map(job => <article key={job.id}><div><FileText size={17} /><span><strong>{job.originalName}</strong><small>{job.kind === "paper_response" ? "纸质答卷" : "题目资料"} · {new Date(job.createdAt).toLocaleString("zh-CN")}</small></span></div><span className="job-status"><CheckCircle2 size={14} /> {job.status === "needs_review" ? "待 OCR / 切分审核" : job.status}</span></article>)}</div></section>}
    <div className="archive-footnote"><Archive size={17} /><p>示例题目仅用于展示训练界面。真实导入的资料会与原始文件、页码、切分区域、OCR 版本和标签审核记录建立回链。</p></div>
  </div>;
}

function ReviewWorkbench({ documents, notify, refreshDocuments }: { documents: MyEuclidReviewDocumentSummary[]; notify: (message: string) => void; refreshDocuments: () => Promise<void> }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MyEuclidReviewDocumentDetail | null>(null);
  const [pageId, setPageId] = useState<string | null>(null);
  const [pageText, setPageText] = useState("");
  const [drafts, setDrafts] = useState<MyEuclidQuestionDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagePreview, setPagePreview] = useState<MyEuclidReviewPagePreview | null>(null);
  const [recognizingRegion, setRecognizingRegion] = useState(false);

  useEffect(() => { if (!selectedId && documents[0]) setSelectedId(documents[0].sourceDocumentId); }, [documents, selectedId]);
  useEffect(() => {
    if (!selectedId || !window.myEuclid) return;
    void (async () => {
      setLoading(true);
      const next = await window.myEuclid!.review.getDocument(selectedId);
      setDetail(next);
      setPageId(next?.pages[0]?.id ?? null);
      setPageText(next?.pages[0]?.ocrText ?? "");
      setDrafts(next?.questions ?? []);
      setLoading(false);
    })();
  }, [selectedId]);
  const activePage = detail?.pages.find(page => page.id === pageId) ?? null;
  useEffect(() => {
    let cancelled = false;
    setPagePreview(null);
    if (!pageId || !window.myEuclid) return () => { cancelled = true; };
    void (async () => {
      try {
        const preview = await window.myEuclid!.review.getPagePreview(pageId);
        if (!cancelled) setPagePreview(preview);
      } catch (error) {
        if (!cancelled) setPagePreview({ pageId, pageNumber: activePage?.pageNumber ?? 0, sourceKind: "text", available: false, reason: error instanceof Error ? error.message : "无法生成本地页面预览。" });
      }
    })();
    return () => { cancelled = true; };
  }, [pageId]);
  const selectPage = (nextPageId: string) => { setPageId(nextPageId); setPageText(detail?.pages.find(page => page.id === nextPageId)?.ocrText ?? ""); };
  const savePage = async () => {
    if (!pageId || !window.myEuclid) return;
    await window.myEuclid.review.updatePageOcr(pageId, pageText);
    const next = await window.myEuclid.review.getDocument(selectedId!);
    setDetail(next);
    await refreshDocuments();
    notify("本页 OCR 文本已保存并标记为已审核");
  };
  const addQuestion = () => {
    if (!detail?.pages[0]) return;
    setDrafts(current => [...current, { pageId: activePage?.id ?? detail.pages[0].id, label: `第 ${current.length + 1} 题`, title: "未命名题目", promptText: activePage?.ocrText ?? "", ordinal: current.length + 1, subquestions: [] }]);
  };
  const updateDraft = (index: number, key: keyof Omit<MyEuclidQuestionDraft, "subquestions">, value: string | number) => setDrafts(current => current.map((draft, draftIndex) => draftIndex === index ? { ...draft, [key]: value } : draft));
  const saveDrafts = async () => {
    if (!selectedId || !window.myEuclid) return;
    await window.myEuclid.review.saveQuestionDrafts(selectedId, drafts);
    const next = await window.myEuclid.review.getDocument(selectedId);
    setDetail(next);
    await refreshDocuments();
    notify("题目与小问切分已确认并写入本地档案");
  };
  const recognizeRegion = async (rect: MyEuclidNormalizedRect) => {
    if (!pageId || !selectedId || !window.myEuclid) return;
    try {
      setRecognizingRegion(true);
      await window.myEuclid.review.recognizeRegion({ pageId, rect });
      const next = await window.myEuclid.review.getDocument(selectedId);
      setDetail(next);
      await refreshDocuments();
      notify("局部 OCR 已保存为独立证据；请审核后再采用文本。");
    } catch (error) { notify(error instanceof Error ? error.message : "局部 OCR 失败"); } finally { setRecognizingRegion(false); }
  };
  const adoptRegionText = (text: string) => {
    if (!text.trim()) return;
    setPageText(current => current.trim() ? `${current.trim()}\n\n${text.trim()}` : text.trim());
    notify("局部识别文本已添加到编辑区；保存后才会确认本页 OCR。");
  };

  if (!window.myEuclid) return <div className="view-shell"><SectionTitle eyebrow="REVIEW WORKBENCH" title="审核工作台" /><div className="review-empty"><FileSearch size={32} /><h3>浏览器预览不访问你的本地资料。</h3><p>请通过 `pnpm dev:desktop` 启动桌面版本，导入资料后在这里审核页面、OCR 文本、题目和小问。</p></div></div>;
  if (!documents.length) return <div className="view-shell"><SectionTitle eyebrow="REVIEW WORKBENCH" title="审核工作台" /><div className="review-empty"><Archive size={32} /><h3>还没有待审核资料。</h3><p>从“工作台”或“题库档案”导入 PDF、图片或纸质答卷后，系统会在本地建立页面记录，并把它们列在这里。</p></div></div>;
  return <div className="view-shell review-view"><SectionTitle eyebrow="LOCAL OCR · HUMAN REVIEW" title="审核工作台" action={<span className="subtle-caption">原件、OCR 版本与确认切分均保存在本机</span>} />
    <div className="review-layout"><aside className="review-doc-list"><p className="eyebrow">待审核资料 · {documents.length}</p>{documents.map(document => <button key={document.sourceDocumentId} className={selectedId === document.sourceDocumentId ? "is-selected" : ""} onClick={() => setSelectedId(document.sourceDocumentId)}><FileText size={16} /><span><strong>{document.originalName}</strong><small>{document.kind === "paper_response" ? "纸质答卷" : "题目资料"} · {document.pageCount} 页</small></span><i>{document.reviewStatus === "needs_review" ? "待审" : "已审"}</i></button>)}</aside>
      <section className="review-page-panel">{loading || !detail ? <div className="review-loading">正在读取本地审核档案…</div> : <><div className="review-panel-head"><div><p className="eyebrow">PAGE REVIEW</p><h3>{detail.originalName}</h3></div><span className="status-pill">{activePage?.ocrStatus === "failed" ? "OCR 待重试" : activePage?.ocrStatus === "pending" ? "等待 OCR" : "可人工确认"}</span></div><div className="page-tabs">{detail.pages.map(page => <button key={page.id} className={pageId === page.id ? "is-selected" : ""} onClick={() => selectPage(page.id)}>P.{page.pageNumber}<small>{page.ocrStatus === "extracted" ? "已提取" : page.ocrStatus === "failed" ? "失败" : "待处理"}</small></button>)}</div><div className="original-preview"><span className="page-watermark">{activePage ? String(activePage.pageNumber).padStart(2, "0") : "—"}</span><div><p className="eyebrow">ORIGINAL PAGE LINK</p><strong>原始页码已关联</strong><small>拖拽框选的局部识别会单独留存，只有你点击采用并保存时才会进入本页人工 OCR。</small></div></div><OcrRegionSelector preview={pagePreview} regions={activePage?.regions ?? []} isBusy={recognizingRegion} onRecognize={recognizeRegion} onUseText={adoptRegionText} /><label className="ocr-editor"><span><strong>OCR 文本</strong><small>可直接修订识别错误，保存后保留为人工审核版。</small></span><textarea value={pageText} onChange={event => setPageText(event.target.value)} placeholder="本地 OCR 提取的文本会显示在这里。" /></label><div className="review-actions"><span>{activePage?.reviewStatus === "confirmed" ? <><CheckCircle2 size={15} /> 已确认本页文本</> : "修改后请保存本页文本"}</span><button className="primary-button" onClick={savePage}><Save size={15} /> 保存本页 OCR</button></div></>}</section>
      <section className="draft-panel">{detail && <><div className="review-panel-head"><div><p className="eyebrow">QUESTION BOUNDARIES</p><h3>题目与小问切分</h3></div><button className="icon-label" onClick={addQuestion}><Plus size={15} /> 新增题目</button></div><p className="draft-note">从 OCR 文本创建题目草案，再确认写入本地档案。当前版本不会自动替换你的人工编辑。</p><div className="draft-list">{drafts.map((draft, index) => <article key={`${draft.id ?? "new"}-${index}`} className="draft-card"><div className="draft-card-head"><span className="draft-index">{String(index + 1).padStart(2, "0")}</span><input value={draft.label} onChange={event => updateDraft(index, "label", event.target.value)} aria-label="题号" /><button className="remove-draft" onClick={() => setDrafts(current => current.filter((_, draftIndex) => draftIndex !== index))} aria-label="删除题目草案"><Trash2 size={15} /></button></div><input className="draft-title" value={draft.title} onChange={event => updateDraft(index, "title", event.target.value)} aria-label="题目标题" /><textarea value={draft.promptText} onChange={event => updateDraft(index, "promptText", event.target.value)} aria-label="题目文本" /><label className="draft-page-select">来源页<select value={draft.pageId} onChange={event => updateDraft(index, "pageId", event.target.value)}>{detail.pages.map(page => <option key={page.id} value={page.id}>第 {page.pageNumber} 页</option>)}</select></label></article>)}{!drafts.length && <div className="no-drafts"><Sparkles size={17} /> 先新增一题，或等待后续自动切分建议。</div>}</div><button className="primary-button wide-button" onClick={saveDrafts} disabled={!drafts.length}><Check size={15} /> 确认并写入题目档案</button></>}</section>
    </div></div>;
}

function TrainingView({ initialId, backToLibrary, onSubmit, notify }: { initialId: string; backToLibrary: () => void; onSubmit: () => void; notify: (message: string) => void }) {
  const [mode, setMode] = useState(() => new URLSearchParams(window.location.search).get("mode") === "ink" ? "手写板书" : "键盘作答");
  const [answer, setAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [session, setSession] = useState<MyEuclidPracticeSession | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const task = questions.find(q => q.id === initialId) ?? questions[0];
  const save = async (status: "draft" | "submitted") => {
    if (!window.myEuclid) { if (status === "submitted") { setSubmitted(true); onSubmit(); } return; }
    try {
      setIsSaving(true);
      const next = await window.myEuclid.practice.saveResponse({ sessionId: session?.id, referenceKey: task.id, title: `${task.source} · ${task.number}`, answerFormat: mode === "手写板书" ? "handwritten" : "keyboard", content: answer, status });
      setSession(next);
      if (status === "submitted") { setSubmitted(true); onSubmit(); } else notify("草稿已写入本地档案");
    } catch (error) { notify(error instanceof Error ? error.message : "作答保存失败"); } finally { setIsSaving(false); }
  };
  const attachPaper = async () => {
    if (!window.myEuclid) { setAnswer("已添加一份待识别的纸质作答附件。"); return; }
    try {
      setIsSaving(true);
      const result = await window.myEuclid.practice.selectPaperAttachments({ sessionId: session?.id, referenceKey: task.id, title: `${task.source} · ${task.number}` });
      if (result.session) { setSession(result.session); notify("纸质答案已归档到本次作答"); }
    } catch (error) { notify(error instanceof Error ? error.message : "纸质答案归档失败"); } finally { setIsSaving(false); }
  };
  const saveInk = async (payload: { canvasWidth: number; canvasHeight: number; previewSvg: string; layers: MyEuclidInkLayer[] }, status: "draft" | "submitted") => {
    if (!window.myEuclid) { notify("浏览器预览仅展示画布；请启动桌面版本保存笔迹档案。"); return; }
    try {
      setIsSaving(true);
      const result = await window.myEuclid.practice.saveInkResponse({ sessionId: session?.id, referenceKey: task.id, title: `${task.source} · ${task.number}`, status, ...payload });
      setSession(result.session);
      if (status === "submitted") { setSubmitted(true); onSubmit(); } else notify("笔迹草稿已写入本地档案");
    } catch (error) { notify(error instanceof Error ? error.message : "笔迹保存失败"); } finally { setIsSaving(false); }
  };
  const attachmentCount = session?.responses.flatMap(response => response.attachments).length ?? 0;
  return <div className="training-view"><button className="back-link" onClick={backToLibrary}><ArrowLeft size={16} /> 返回题库档案</button><div className="training-top"><div><p className="eyebrow">TRAINING SESSION · {task.id}</p><h2>{task.source} · {task.number}</h2></div><div className="timer-block"><Clock3 size={18} /><strong>00:00</strong><span>本次会话</span></div></div>
    <div className="training-grid"><article className="problem-sheet"><div className="sheet-label"><span>题面</span><span>原件回链将在导入后显示</span></div><h3>{task.title}</h3><p>{task.text}</p><div className="math-block">a<sub>n+1</sub> = f(a<sub>n</sub>), &nbsp; n ∈ ℕ<sup>+</sup></div><p>请写出完整推理链，并说明你所使用的关键不变量或归纳结构。</p><div className="sheet-tags">{task.tags.map(tag => <span key={tag} className="tag">{tag}</span>)}<span className="tag proof-tag">需要完整证明</span></div></article>
      <aside className="answer-panel"><div className="answer-head"><div><p className="eyebrow">YOUR WORK</p><h3>作答记录</h3></div><span className="autosave">{session ? <><CheckCircle2 size={14} /> 已保存 {session.responses.length} 个版本</> : "尚未保存"}</span></div><div className="answer-modes">{["键盘作答", "手写板书", "上传纸质答案"].map(item => <button key={item} className={mode === item ? "is-selected" : ""} onClick={() => setMode(item)}>{item === "键盘作答" ? <Keyboard size={15} /> : item === "手写板书" ? <MousePointer2 size={15} /> : <ImageUp size={15} />}{item}</button>)}</div>
        {mode === "上传纸质答案" ? <div className="input-placeholder"><ImageUp size={26} /><strong>纸质答案附件</strong><p>选择 PDF、扫描件或照片后，文件会复制到本地档案，并绑定到本次作答。</p><button onClick={attachPaper} disabled={isSaving}>{isSaving ? "正在归档…" : "选择纸质答案"}</button>{attachmentCount ? <small>已关联 {attachmentCount} 个附件</small> : null}</div> : mode === "手写板书" ? <InkCanvas onSave={saveInk} isSaving={isSaving} /> : <><textarea value={answer} onChange={e => setAnswer(e.target.value)} onBlur={() => void save("draft")} placeholder="在这里写下证明。公式可以使用 LaTeX 语法，例如 \frac{a}{b}。" /><p className="session-hint">离开输入框会自动存草稿；每次保存均保留为独立版本。</p></>}
        {mode !== "手写板书" && <div className="answer-actions"><button className="secondary-button" onClick={() => setAnswer("")}><Undo2 size={15} /> 清空草稿</button><button className="secondary-button" onClick={() => void save("draft")} disabled={isSaving || mode === "上传纸质答案"}><Save size={15} /> 保存草稿</button><button className="primary-button" onClick={() => void save("submitted")} disabled={isSaving || mode === "上传纸质答案"}><Send size={15} /> 提交并分析</button></div>}
        {submitted && <div className="assessment-card"><div><p className="eyebrow">ASSESSMENT ARCHIVE</p><h4>作答已进入本地评分档案</h4></div><span>等待评分确认</span><p>可在“错题证据”中为本次作答建立可回看的评分依据、错因和模块拆分。AI 判卷须待服务与密钥由你主动配置后才会启用。</p></div>}
      </aside>
    </div>
  </div>;
}

function EvidenceView({ openTutor, openTraining }: { openTutor: (id: string) => void; openTraining: (id: string) => void }) {
  return <div className="view-shell"><SectionTitle eyebrow="MISCONCEPTION LEDGER" title="错题证据" action={<span className="subtle-caption">所有结论都应能回看题面、作答与评分依据</span>} />
    <div className="evidence-summary"><div><span className="number">0</span><p>已归档错题</p></div><div><span className="number">4</span><p>错因分类框架</p></div><div><span className="number">—</span><p>当前最弱模块</p></div><p className="summary-note">下列为待导入真实答卷前的界面演示；不会混入长期统计。</p></div>
    <div className="evidence-cards">{evidenceItems.map(item => <article className="mistake-card" key={item.id}><div className="mistake-top"><div><p className="record-id">{item.title}</p><h4>{item.subtitle}</h4></div><strong>{item.score}</strong></div><div className="mistake-body"><span className="mistake-tag">{item.tag}</span><p>{item.reason}</p></div><div className="mistake-actions"><button className="secondary-button" onClick={() => openTraining(item.id === "miss-03" ? "E-2025-07b" : "E-2024-10")}><PenLine size={15} /> 查看作答</button><button className="primary-button" onClick={() => openTutor(item.id)}><Sparkles size={15} /> AI 引导讲解</button></div></article>)}</div>
  </div>;
}

function ReportsView() {
  return <div className="view-shell"><SectionTitle eyebrow="LONGITUDINAL EVIDENCE" title="报告与轨迹" action={<button className="text-action"><Download size={15} /> 导出报告结构</button>} />
    <div className="report-intro"><div><p className="eyebrow">NOT ENOUGH DATA YET</p><h2>第一份真实答卷会从这里开始留下轨迹。</h2><p>提交在线或纸质答卷后，系统将按题型、知识模块、得分点、错因、用时与作答形态生成统一报告。</p></div><img src="/manus-storage/euclid-archive-report_69f424c7.jpg" alt="数学报告材料装饰" /></div>
    <div className="report-grid"><article className="report-card wide"><div className="card-head"><div><p className="eyebrow">PROGRESS CURVE</p><h3>进步曲线</h3></div><span>等待第一批真实数据</span></div><div className="empty-chart"><div className="chart-axis" /><div className="chart-line dashed" /><div className="chart-line dashed line-two" /><p>完成训练后，曲线将展示能力估计与置信区间。</p></div></article>
      <article className="report-card"><div className="card-head"><div><p className="eyebrow">MODULE BREAKDOWN</p><h3>模块分析</h3></div><BarChart3 size={18} /></div><div className="module-list">{["代数与函数", "几何", "计数与概率", "数论"].map(item => <div key={item}><span>{item}</span><i><b /></i><em>待测</em></div>)}</div></article>
      <article className="report-card"><div className="card-head"><div><p className="eyebrow">IRT PROFILE</p><h3>能力估计</h3></div><BrainCircuit size={18} /></div><div className="irt-empty"><Target size={30} /><p>系统会在积累足够的真实作答后显示个人能力参数与上游依赖路径。</p></div></article></div>
  </div>;
}

function ImportModal({ kind, onClose, onCompleted, openTraining, desktopImport }: { kind: Exclude<ImportKind, null>; onClose: () => void; onCompleted: (message: string) => void; openTraining: () => void; desktopImport: (kind: MyEuclidImportKind) => Promise<number> }) {
  const [fileName, setFileName] = useState("");
  const [url, setUrl] = useState("");
  const [step, setStep] = useState(1);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const isPaper = kind === "paper";
  const title = kind === "source" ? "导入题目资料" : isPaper ? "上传纸质答卷" : "新建在线作答";
  const handleFile = (event: ChangeEvent<HTMLInputElement>) => setFileName(event.target.files?.[0]?.name ?? "");
  const complete = async () => {
    setImportError(null);
    if (window.myEuclid) {
      try {
        setIsImporting(true);
        const count = await desktopImport(isPaper ? "paper_response" : "source_document");
        if (!count) { setIsImporting(false); return; }
        setStep(2);
        onCompleted(isPaper ? `已归档 ${count} 份纸质答卷，等待题号审核` : `已归档 ${count} 份资料，等待 OCR 与切分审核`);
      } catch (error) {
        setImportError(error instanceof Error ? error.message : "导入失败，请检查资料后重试。");
      } finally { setIsImporting(false); }
      return;
    }
    setStep(2);
    window.setTimeout(() => onCompleted(isPaper ? "纸质答卷演示任务已建立" : "资料演示任务已建立"), 350);
  };
  if (kind === "answer") return <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="modal-card answer-modal"><button className="modal-close" onClick={onClose}><X size={19} /></button><p className="eyebrow">ONLINE ANSWER</p><h2>开始一份在线作答</h2><p>请选择题目后进入统一作答页。键入、手写与纸质附件会按时间线保存到同一题目中。</p><button className="primary-button wide-button" onClick={() => { onClose(); openTraining(); }}><Play size={16} /> 打开示例题面</button></div></div>;
  return <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="modal-card"><button className="modal-close" onClick={onClose}><X size={19} /></button><p className="eyebrow">LOCAL IMPORT · STEP {step} / 2</p><h2>{title}</h2>{step === 1 ? <><p className="modal-copy">原始文件会保留在本地。{isPaper ? "提交后将识别页面、题号与手写作答区域；审核后进入与在线作答一致的评分流程。" : "导入后将生成 OCR、切分和标签建议，供你逐项审核。"}</p>{window.myEuclid ? <button className="native-file-button" onClick={complete} disabled={isImporting}><FolderOpen size={23} /><span><strong>{isImporting ? "正在归档本地文件…" : "从本机选择资料"}</strong><small>通过 macOS 原生文件选择器导入</small></span><ChevronRight size={17} /></button> : <><label className="drop-zone"><input type="file" accept=".pdf,.png,.jpg,.jpeg,.heic,.txt,.md" onChange={handleFile} /><Upload size={24} /><strong>{fileName || "选择或拖拽文件"}</strong><span>支持 PDF、图片、扫描件、文本</span></label><div className="import-divider"><span>或</span></div><label className="url-field"><Link size={16} /><input value={url} onChange={e => setUrl(e.target.value)} placeholder="粘贴资料或 PDF 链接" /></label></>}{importError && <p className="import-error"><CircleHelp size={14} /> {importError}</p>}<div className="modal-actions"><button className="secondary-button" onClick={onClose}>取消</button>{!window.myEuclid && <button className="primary-button" disabled={!fileName && !url} onClick={complete}>建立演示任务<ChevronRight size={15} /></button>}</div></> : <div className="import-progress"><CheckCircle2 size={32} /><h3>{isPaper ? "已建立答卷审核任务" : "已建立资料审核任务"}</h3><p>{isPaper ? "下一步会按页识别题号、手写区域和作答归属。" : "下一步会显示页码、切分边界、OCR 文本与标签草案。"}</p><div className="progress-steps"><span className="done"><Check size={13} /> 原件归档</span><span>等待 OCR</span><span>审核切分</span></div><button className="primary-button wide-button" onClick={onClose}>返回工作台</button></div>}</div></div>;
}

function BackupModal({ onClose, notify }: { onClose: () => void; notify: (message: string) => void }) {
  const [selection, setSelection] = useState<MyEuclidBackupSelection | null>(null);
  const [busy, setBusy] = useState(false);
  const exportBackup = async () => {
    if (!window.myEuclid) { notify("浏览器预览不访问本地档案；请启动桌面版本。"); return; }
    try {
      setBusy(true);
      const result = await window.myEuclid.backup.export();
      if ("outputName" in result) notify(`已导出本地备份：${result.outputName}`);
    } catch (error) { notify(error instanceof Error ? error.message : "备份导出失败"); } finally { setBusy(false); }
  };
  const selectRestore = async () => {
    if (!window.myEuclid) { notify("浏览器预览不访问本地档案；请启动桌面版本。"); return; }
    try {
      setBusy(true);
      const result = await window.myEuclid.backup.selectForRestore();
      if (result.selection) setSelection(result.selection);
    } catch (error) { notify(error instanceof Error ? error.message : "备份预检失败"); } finally { setBusy(false); }
  };
  const restore = async () => {
    if (!selection || !window.myEuclid) return;
    try {
      setBusy(true);
      await window.myEuclid.backup.restore(selection.token);
      notify("备份已恢复，工作台将重新加载本地档案");
      onClose();
      window.setTimeout(() => window.location.reload(), 800);
    } catch (error) { notify(error instanceof Error ? error.message : "备份恢复失败"); } finally { setBusy(false); }
  };
  return <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="modal-card backup-modal"><button className="modal-close" onClick={onClose}><X size={19} /></button><p className="eyebrow">LOCAL BACKUP · RESTORE</p><h2>本地备份与恢复</h2><p className="modal-copy">导出包包含 SQLite、题源原件、答卷附件与校验清单。恢复会覆盖当前本地档案，并在替换前自动保留恢复点。</p><div className="backup-actions"><button className="native-file-button" onClick={exportBackup} disabled={busy}><Download size={22} /><span><strong>导出当前档案</strong><small>生成可迁移、可校验的备份包</small></span><ChevronRight size={17} /></button><button className="native-file-button" onClick={selectRestore} disabled={busy}><Upload size={22} /><span><strong>选择备份包并预检</strong><small>先校验文件与清单，不会立即覆盖</small></span><ChevronRight size={17} /></button></div>{selection && <div className="restore-preflight"><p className="eyebrow">RESTORE PREVIEW</p><h3>{selection.fileName}</h3><div><span>{selection.documentCount} 份资料</span><span>{selection.responseCount} 个答卷版本</span><span>{selection.attachmentCount} 个附件</span></div><p>此操作将覆盖当前本地档案。请确认已导出需要保留的最新数据。</p><button className="primary-button wide-button destructive-action" onClick={restore} disabled={busy}>确认覆盖并恢复</button></div>}<div className="modal-actions"><button className="secondary-button" onClick={onClose}>关闭</button></div></div></div>;
}

function TutorModal({ onClose }: { onClose: () => void }) {
  const [stage, setStage] = useState(0);
  const stages = ["先判断：题设中的哪个量在递推过程中最可能保持不变？", "很好。接着尝试将相邻两项的关系改写为差分或比值形式。", "最后，把你找到的量代回初始条件；这会把猜想转化为完整证明。"]; 
  return <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="modal-card tutor-modal"><button className="modal-close" onClick={onClose}><X size={19} /></button><p className="eyebrow">SOCRATIC AI TUTOR</p><h2>从线索开始，而不是从答案开始。</h2><div className="tutor-question"><Lightbulb size={19} /><p>{stages[stage]}</p></div><div className="tutor-tabs"><span className="is-current">破题切入点</span><span>必备知识</span><span>同类旧题</span><span>变体追问</span></div><textarea placeholder="写下你的想法，AI 会基于你的表述继续追问。" /><div className="modal-actions"><button className="secondary-button" onClick={() => setStage(Math.max(0, stage - 1))} disabled={stage === 0}>上一步</button><button className="primary-button" onClick={() => setStage(Math.min(stages.length - 1, stage + 1))}>{stage === stages.length - 1 ? "查看三种解法" : "继续引导"}<ChevronRight size={15} /></button></div></div></div>;
}

export default function Home() {
  const [active, setActive] = useState<View>(() => {
    const view = new URLSearchParams(window.location.search).get("view");
    if (view === "training") return "训练会话";
    if (view === "evidence") return "错题证据";
    if (view === "reports") return "报告与轨迹";
    if (view === "review") return "审核工作台";
    if (view === "library") return "题库档案";
    return "工作台";
  });
  const [importKind, setImportKind] = useState<ImportKind>(null);
  const [trainingId, setTrainingId] = useState("E-2025-07b");
  const [tutorOpen, setTutorOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [importJobs, setImportJobs] = useState<MyEuclidImportJob[]>([]);
  const [reviewDocuments, setReviewDocuments] = useState<MyEuclidReviewDocumentSummary[]>([]);
  const [assessmentSessions, setAssessmentSessions] = useState<MyEuclidPracticeSession[]>([]);
  const [assessmentRecords, setAssessmentRecords] = useState<MyEuclidAssessmentRecord[]>([]);
  const [assessmentDashboard, setAssessmentDashboard] = useState<MyEuclidAssessmentDashboard | null>(null);
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(null), 3000); };
  const refreshImportJobs = async () => { if (window.myEuclid) setImportJobs(await window.myEuclid.archive.listImportJobs()); };
  const refreshReviewDocuments = async () => { if (window.myEuclid) setReviewDocuments(await window.myEuclid.review.listDocuments()); };
  const refreshAssessments = async () => { if (window.myEuclid) { const [sessions, records, dashboard] = await Promise.all([window.myEuclid.assessment.listSessions(), window.myEuclid.assessment.listRecords(), window.myEuclid.assessment.getDashboard()]); setAssessmentSessions(sessions); setAssessmentRecords(records); setAssessmentDashboard(dashboard); } };
  useEffect(() => { void refreshImportJobs(); void refreshReviewDocuments(); void refreshAssessments(); }, []);
  const desktopImport = async (kind: MyEuclidImportKind) => {
    if (!window.myEuclid) return 0;
    const result = await window.myEuclid.archive.selectAndImport(kind);
    if (!result.cancelled) { await refreshImportJobs(); await refreshReviewDocuments(); }
    return result.jobs.length;
  };
  const openTraining = (id = "E-2025-07b") => { setTrainingId(id); setActive("训练会话"); };
  const renderView = () => {
    if (active === "题库档案") return <LibraryView openImport={setImportKind} openTraining={openTraining} importJobs={importJobs} openReview={() => setActive("审核工作台")} />;
    if (active === "审核工作台") return <ReviewWorkbench documents={reviewDocuments} notify={notify} refreshDocuments={refreshReviewDocuments} />;
    if (active === "训练会话") return <TrainingView initialId={trainingId} backToLibrary={() => setActive("题库档案")} onSubmit={() => notify("作答已提交；后续可在错题证据和报告中继续复盘")} notify={notify} />;
    if (active === "错题证据") return <EvidenceWorkspace sessions={assessmentSessions} records={assessmentRecords} refresh={refreshAssessments} notify={notify} />;
    if (active === "报告与轨迹") return <ReportsWorkspace dashboard={assessmentDashboard} />;
    return <Dashboard openImport={setImportKind} openTraining={openTraining} importedCount={importJobs.length} />;
  };
  return <div className="archive-app"><SideNav active={active} onChange={setActive} /><main className="workbench"><header className="topbar"><div className="crumb"><span>档案工作台</span><i /> <span>{active}</span></div><div className="top-actions"><button className="quiet-button" onClick={() => setBackupOpen(true)}>本地备份 <ArrowUpRight size={15} /></button><button className="profile-chip"><span>明</span><ChevronDown size={14} /></button></div></header>{renderView()}</main>{importKind && <ImportModal kind={importKind} onClose={() => setImportKind(null)} onCompleted={notify} openTraining={() => openTraining()} desktopImport={desktopImport} />}{backupOpen && <BackupModal onClose={() => setBackupOpen(false)} notify={notify} />}{tutorOpen && <TutorModal onClose={() => setTutorOpen(false)} />}{toast && <div className="toast" role="status"><GraduationCap size={17} /> {toast}</div>}</div>;
}
