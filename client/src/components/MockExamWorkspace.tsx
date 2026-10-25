/** 欧几里得档案室：全真模考使用已发布题目的不可变快照，并为每题创建统一作答会话。 */
import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  FileCheck2,
  Play,
  Plus,
  Send,
  Sparkles,
  TimerReset,
} from "lucide-react";
import { api, isDesktop, runAction } from "@/lib/api";
import { MOCK_EXAM } from "@/lib/constants";
import { mockExamStatusName } from "@/lib/ui";
import "./MockExamWorkspace.css";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useNotify } from "@/lib/toast";

const formatRemaining = (seconds: number) =>
  `${String(Math.max(0, Math.floor(seconds / 3600))).padStart(2, "0")}:${String(Math.max(0, Math.floor((seconds % 3600) / 60))).padStart(2, "0")}:${String(Math.max(0, seconds % 60)).padStart(2, "0")}`;

/** 计时器独立成小组件：每秒重渲染只发生在时钟内部，不波及题目列表。 */
function MockClock({ exam }: { exam: MyEuclidMockExam }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (exam.status !== "active") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [exam.status]);
  const remaining = !exam.startedAt
    ? exam.durationSeconds
    : Math.max(
        0,
        exam.durationSeconds -
          Math.floor((now - new Date(exam.startedAt).getTime()) / 1000)
      );
  return (
    <div className={`mock-clock ${remaining === 0 ? "is-expired" : ""}`}>
      <Clock3 size={18} />
      <strong>{formatRemaining(remaining)}</strong>
      <span>剩余时间</span>
    </div>
  );
}

function MockExamAnswer({
  exam,
  item,
  onSaved,
}: {
  exam: MyEuclidMockExam;
  item: MyEuclidMockExamItem;
  onSaved: () => Promise<void>;
}) {
  const notify = useNotify();
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const save = (status: "draft" | "submitted") =>
    runAction({
      setBusy,
      notify,
      fallbackError: "模考作答保存失败。",
      work: async () => {
        await api().practice.saveResponse({
          sessionId: item.sessionId,
          referenceKey: `mock:${exam.id}:q:${item.ordinal}`,
          title: `${exam.title} · 第 ${item.ordinal} 题`,
          answerFormat: "keyboard",
          content: answer,
          status,
        });
        await onSaved();
        notify(
          status === "submitted"
            ? `第 ${item.ordinal} 题作答已提交到模考档案。`
            : `第 ${item.ordinal} 题草稿已保存。`
        );
      },
    });
  return (
    <section className="mock-answer">
      <label>
        <span>第 {item.ordinal} 题作答</span>
        <textarea
          value={answer}
          onChange={event => setAnswer(event.target.value)}
          placeholder="在此完成本题推理；保存草稿不会提前交卷。"
          disabled={exam.status === "submitted"}
        />
      </label>
      <div>
        <small>
          {item.submittedResponseCount
            ? "本题已有已提交版本"
            : item.responseCount
              ? "本题已有草稿版本"
              : "尚未保存本题作答"}
        </small>
        <button
          className="secondary-button"
          disabled={busy || exam.status === "submitted"}
          onClick={() => void save("draft")}
        >
          保存草稿
        </button>
        <button
          className="primary-button"
          disabled={busy || exam.status === "submitted"}
          onClick={() => void save("submitted")}
        >
          提交本题
        </button>
      </div>
    </section>
  );
}

export function MockExamWorkspace({
  backToSingle,
}: {
  backToSingle: () => void;
}) {
  const notify = useNotify();
  const [questions, setQuestions] = useState<MyEuclidQuestionBankQuestion[]>(
    []
  );
  const [exams, setExams] = useState<MyEuclidMockExam[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [exam, setExam] = useState<MyEuclidMockExam | null>(null);
  const [activeItem, setActiveItem] = useState(0);
  const [title, setTitle] = useState(
    () => `Euclid 全真模拟 · ${new Date().toLocaleDateString("zh-CN")}`
  );
  const [busy, setBusy] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [composing, setComposing] = useState(false);
  const refresh = async () => {
    if (!isDesktop) return;
    const [nextQuestions, nextExams] = await Promise.all([
      api().library.listQuestions({ limit: 100 }),
      api().mockExam.list(),
    ]);
    setQuestions(nextQuestions);
    setExams(nextExams);
    if (exam) {
      const updated = await api().mockExam.get(exam.id);
      setExam(updated);
    }
  };
  useEffect(() => {
    refresh().catch(error =>
      notify(
        `读取模考档案失败：${error instanceof Error ? error.message : "未知错误"}`
      )
    );
  }, []);
  const toggle = (id: string) =>
    setSelectedIds(current =>
      current.includes(id)
        ? current.filter(item => item !== id)
        : current.length < MOCK_EXAM.questionCount
          ? [...current, id]
          : current
    );
  const totalPoints =
    exam?.items.reduce((sum, item) => sum + (item.maximumPoints ?? 0), 0) ?? 0;
  const composeWithAi = () =>
    runAction({
      setBusy: setComposing,
      notify,
      fallbackError: "AI 组卷失败。",
      work: async () => {
        notify(
          "AI 组卷中：正在按真实 Euclid 卷面结构（10 题、难度递进、多模块覆盖）挑选题目…"
        );
        const result = await api().ai.composeMockExam({ title });
        setExam(result.exam);
        setExams(current => [result.exam, ...current]);
        setActiveItem(0);
        notify(
          result.rationale
            ? `AI 组卷完成（${result.providerLabel}）：${result.rationale}`
            : `AI 组卷完成（${result.providerLabel}）：已按模块与难度分布建立 10 题模考。`
        );
      },
    });
  const create = () =>
    runAction({
      setBusy,
      notify,
      fallbackError: "模考创建失败。",
      work: async () => {
        const next = await api().mockExam.create({
          title,
          questionIds: selectedIds,
          durationSeconds: MOCK_EXAM.durationSeconds,
        });
        setExam(next);
        setExams(current => [next, ...current]);
        setActiveItem(0);
        notify(
          `全真模考已建立：${MOCK_EXAM.questionCount} 道题、150 分钟，题目已写入不可变快照。`
        );
      },
    });
  const start = () =>
    runAction({
      setBusy,
      notify,
      fallbackError: "模考无法开始。",
      work: async () => {
        if (!exam) return;
        const next = await api().mockExam.start(exam.id);
        setExam(next);
        notify("模考已开始。计时只在本地记录，答案不会自动上传。");
      },
    });
  const submit = async () => {
    if (!isDesktop || !exam) return;
    setConfirmSubmit(true);
  };
  const submitConfirmed = async () => {
    if (!exam) return;
    setConfirmSubmit(false);
    try {
      setBusy(true);
      const next = await api().mockExam.submit(exam.id);
      setExam(next);
      await refresh();
      notify("模考已交卷。现在可在错题证据与报告中进行评分和复盘。");
    } catch (error) {
      notify(error instanceof Error ? error.message : "模考交卷失败。");
    } finally {
      setBusy(false);
    }
  };
  if (!isDesktop)
    return (
      <div className="view-shell">
        <div className="review-empty">
          <TimerReset size={32} />
          <h3>浏览器预览不创建本地模考。</h3>
          <p>
            请通过 <code>pnpm dev:desktop</code> 使用已发布题目创建 10 题、150
            分钟的真实本地模考。
          </p>
        </div>
      </div>
    );
  if (exam) {
    const item = exam.items[activeItem] ?? exam.items[0];
    return (
      <div className="view-shell mock-exam-view">
        <div className="mock-exam-head">
          <button className="text-action" onClick={() => setExam(null)}>
            返回模考列表
          </button>
          <div>
            <p className="eyebrow">FULL EUCLID SIMULATION</p>
            <h3>{exam.title}</h3>
            <small>
              {exam.questionCount} 题 · 共 {totalPoints || "—"} 分 ·{" "}
              {mockExamStatusName(exam.status)}
            </small>
          </div>
          <MockClock exam={exam} />
          {exam.status === "draft" && (
            <button
              className="primary-button"
              onClick={() => void start()}
              disabled={busy}
            >
              <Play size={15} /> 开始 150 分钟模考
            </button>
          )}
          {exam.status === "active" && (
            <button
              className="primary-button"
              onClick={() => void submit()}
              disabled={busy}
            >
              <Send size={15} /> 交卷并进入评分
            </button>
          )}
        </div>
        <div className="mock-exam-layout">
          <aside className="mock-question-nav">
            {exam.items.map((item, index) => (
              <button
                key={item.id}
                className={activeItem === index ? "is-selected" : ""}
                onClick={() => setActiveItem(index)}
              >
                <strong>{String(item.ordinal).padStart(2, "0")}</strong>
                <span>
                  {item.submittedResponseCount ? (
                    <CheckCircle2 size={14} />
                  ) : item.responseCount ? (
                    <FileCheck2 size={14} />
                  ) : (
                    "—"
                  )}
                </span>
                <small>{item.primaryTopic || "未标注"}</small>
              </button>
            ))}
          </aside>
          {item && (
            <main className="mock-problem">
              <div className="mock-problem-meta">
                <span>{item.label}</span>
                <span>{item.primaryTopic}</span>
                <span>
                  {item.difficulty ? `难度 ${item.difficulty}/5` : "难度未设定"}
                </span>
                {item.maximumPoints && <span>{item.maximumPoints} 分</span>}
              </div>
              <h2>{item.title || item.label}</h2>
              <p className="mock-prompt">{item.promptText}</p>
              <MockExamAnswer exam={exam} item={item} onSaved={refresh} />
            </main>
          )}
        </div>
        {confirmSubmit && (
          <ConfirmDialog
            title="确认交卷"
            message="交卷后模考会锁定为已提交状态，但既有作答版本会保留。"
            confirmLabel="交卷并进入评分"
            busy={busy}
            onConfirm={() => void submitConfirmed()}
            onClose={() => setConfirmSubmit(false)}
          />
        )}
      </div>
    );
  }
  return (
    <div className="view-shell mock-exam-builder">
      <div className="section-heading">
        <div>
          <p className="eyebrow">EUCLID 150-MINUTE SIMULATION</p>
          <h3>全真模考</h3>
        </div>
        <button className="text-action" onClick={backToSingle}>
          返回单题训练
        </button>
      </div>
      <section className="mock-intro">
        <TimerReset size={21} />
        <div>
          <strong>10 题 · 150 分钟 · 不可变试卷快照</strong>
          <p>
            从已发布的真实题库选择恰好 10
            道题。创建后，题面、标签和满分将写入本地快照，后续编辑题库不会改变已建立的模考。
          </p>
        </div>
      </section>
      <div className="mock-builder-grid">
        <section>
          <div className="mock-builder-head">
            <div>
              <p className="eyebrow">QUESTION SELECTION</p>
              <h4>选择题目</h4>
            </div>
            <strong>
              {selectedIds.length} / {MOCK_EXAM.questionCount}
            </strong>
          </div>
          {questions.length ? (
            <div className="mock-question-picker">
              {questions.map(question => (
                <label
                  key={question.id}
                  className={
                    selectedIds.includes(question.id) ? "is-selected" : ""
                  }
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(question.id)}
                    onChange={() => toggle(question.id)}
                    disabled={
                      !selectedIds.includes(question.id) &&
                      selectedIds.length >= MOCK_EXAM.questionCount
                    }
                  />
                  <div>
                    <strong>
                      {question.sourceName} · {question.label}
                    </strong>
                    <span>{question.title}</span>
                    <small>
                      {question.primaryTopic} · 难度{" "}
                      {question.difficulty ?? "—"} ·{" "}
                      {question.maximumPoints ?? "—"} 分
                    </small>
                  </div>
                </label>
              ))}
            </div>
          ) : (
            <div className="review-empty">
              <FileCheck2 size={24} />
              <h3>需要先发布正式题目。</h3>
              <p>在审核工作台确认切分并补全标签后，题目才可被纳入真实模考。</p>
            </div>
          )}
        </section>
        <aside className="mock-create-card">
          <p className="eyebrow">EXAM ARCHIVE</p>
          <h4>建立模考试卷</h4>
          <label>
            试卷标题
            <input
              value={title}
              onChange={event => setTitle(event.target.value)}
            />
          </label>
          <dl>
            <div>
              <dt>题数</dt>
              <dd>10 题</dd>
            </div>
            <div>
              <dt>时长</dt>
              <dd>150 分钟</dd>
            </div>
            <div>
              <dt>答案</dt>
              <dd>本地统一作答会话</dd>
            </div>
          </dl>
          <button
            className="primary-button wide-button"
            disabled={busy || selectedIds.length !== MOCK_EXAM.questionCount}
            onClick={() => void create()}
          >
            <Plus size={15} /> 建立全真模考
          </button>
          <button
            className="secondary-button wide-button ai-compose-button"
            disabled={composing}
            onClick={() => void composeWithAi()}
          >
            <Sparkles size={15} />{" "}
            {composing ? "AI 正在组卷…" : "AI 智能组卷（自动选 10 题）"}
          </button>
          <small>
            手动组卷需恰好选择 10 题；AI
            组卷会从题库自动挑选并平衡模块与难度。题库不足 10 题时请先运行 AI
            自动审核或生成变式题。
          </small>
        </aside>
      </div>
      {exams.length > 0 && (
        <section className="mock-history">
          <div className="mock-builder-head">
            <div>
              <p className="eyebrow">LOCAL EXAM ARCHIVE</p>
              <h4>已建立模考</h4>
            </div>
          </div>
          {exams.map(item => (
            <button
              key={item.id}
              onClick={() => {
                setExam(item);
                setActiveItem(0);
              }}
            >
              <span>
                {item.status === "submitted" ? (
                  <CheckCircle2 size={16} />
                ) : (
                  <TimerReset size={16} />
                )}
              </span>
              <div>
                <strong>{item.title}</strong>
                <small>
                  {item.questionCount} 题 · {mockExamStatusName(item.status)}
                </small>
              </div>
              <em>
                {item.submittedAt
                  ? new Date(item.submittedAt).toLocaleString("zh-CN")
                  : new Date(item.createdAt).toLocaleString("zh-CN")}
              </em>
            </button>
          ))}
        </section>
      )}
    </div>
  );
}
