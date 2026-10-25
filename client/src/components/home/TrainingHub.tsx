/** 训练会话：单题训练（题库真实题面，演示题仅作降级）、全真模考与 IRT 专项训练的模式切换。 */
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  ImageUp,
  Keyboard,
  MousePointer2,
  Save,
  Send,
  Undo2,
} from "lucide-react";
import { AdaptiveTrainingWorkspace } from "@/components/AdaptiveTrainingWorkspace";
import { InkCanvas } from "@/components/InkCanvas";
import { MathText } from "@/components/MathText";
import { MockExamWorkspace } from "@/components/MockExamWorkspace";
import { api, isDesktop, runAction } from "@/lib/api";
import { demoTasks } from "@/lib/demoQuestions";
import "@/components/TrainingHub.css";
import { useNotify } from "@/lib/toast";

export function TrainingHub({
  initialId,
  backToLibrary,
  onSubmit,
}: {
  initialId: string;
  backToLibrary: () => void;
  onSubmit: () => void;
}) {
  const [mode, setMode] = useState<"single" | "mock" | "adaptive">(() =>
    initialId === "__mock_exam__" ? "mock" : "single"
  );
  const [selectedId, setSelectedId] = useState(initialId);
  if (mode === "mock")
    return <MockExamWorkspace backToSingle={() => setMode("single")} />;
  if (mode === "adaptive")
    return (
      <AdaptiveTrainingWorkspace
        backToSingle={() => setMode("single")}
        openQuestion={id => {
          setSelectedId(id);
          setMode("single");
        }}
      />
    );
  return (
    <>
      <div className="training-mode-switch">
        <button className="is-selected" onClick={() => setMode("single")}>
          单题训练
        </button>
        <button onClick={() => setMode("mock")}>全真 150 分钟模考</button>
        <button onClick={() => setMode("adaptive")}>IRT 专项训练</button>
      </div>
      <TrainingView
        initialId={selectedId}
        backToLibrary={backToLibrary}
        onSubmit={onSubmit}
      />
    </>
  );
}

type AnswerMode = "keyboard" | "ink" | "paper";

const answerModes: { id: AnswerMode; label: string }[] = [
  { id: "keyboard", label: "键盘作答" },
  { id: "ink", label: "手写板书" },
  { id: "paper", label: "上传纸质答案" },
];

interface BankTrainingTask {
  kind: "bank";
  id: string;
  heading: string;
  title: string;
  promptText: string;
  tags: string[];
  note: string;
  subquestions: MyEuclidQuestionBankSubquestion[];
}
interface DemoTrainingTask {
  kind: "demo";
  id: string;
  heading: string;
  title: string;
  promptText: string;
  tags: string[];
  note: string;
}
type TrainingTask = BankTrainingTask | DemoTrainingTask;

function toTrainingTask(
  bankQuestion: MyEuclidQuestionBankQuestion
): BankTrainingTask {
  return {
    kind: "bank",
    id: bankQuestion.id,
    heading: `${bankQuestion.sourceName} · ${bankQuestion.competitionYear ?? "—"} · ${bankQuestion.label}`,
    title: bankQuestion.title || bankQuestion.label,
    promptText: bankQuestion.promptText,
    tags: [
      bankQuestion.primaryTopic,
      ...bankQuestion.secondaryTopics,
      ...bankQuestion.methods,
    ]
      .filter(Boolean)
      .slice(0, 6),
    note: `原件：${bankQuestion.originalName} · 第 ${bankQuestion.pageNumber} 页`,
    subquestions: bankQuestion.subquestions,
  };
}

function toDemoTrainingTask(initialId: string): DemoTrainingTask {
  const demo = demoTasks.find(item => item.id === initialId) ?? demoTasks[0];
  return {
    kind: "demo",
    id: demo.id,
    heading: `${demo.source} · ${demo.number}`,
    title: demo.title,
    promptText: demo.text,
    tags: demo.tags,
    note: "演示题面：仅用于预览界面，不会计入真实训练统计。",
  };
}

/** 会话计时器：隔离在小组件内，每秒重渲染不波及题面与作答区。 */
function SessionClock() {
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const seconds = Math.floor((now - startedAt) / 1000);
  const elapsed = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  return (
    <div className="timer-block">
      <Clock3 size={18} />
      <strong>{elapsed}</strong>
      <span>本次会话</span>
    </div>
  );
}

export function TrainingView({
  initialId,
  backToLibrary,
  onSubmit,
}: {
  initialId: string;
  backToLibrary: () => void;
  onSubmit: () => void;
}) {
  const notify = useNotify();
  const [mode, setMode] = useState<AnswerMode>(() =>
    new URLSearchParams(window.location.search).get("mode") === "ink"
      ? "ink"
      : "keyboard"
  );
  const [answer, setAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [session, setSession] = useState<MyEuclidPracticeSession | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [bankQuestion, setBankQuestion] =
    useState<MyEuclidQuestionBankQuestion | null>(null);
  const [loadingTask, setLoadingTask] = useState(isDesktop);

  useEffect(() => {
    if (!isDesktop) {
      setLoadingTask(false);
      return;
    }
    let cancelled = false;
    setLoadingTask(true);
    api()
      .library.getQuestion(initialId)
      .then(question => {
        if (!cancelled) {
          setBankQuestion(question);
          setLoadingTask(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBankQuestion(null);
          setLoadingTask(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [initialId]);

  const task: TrainingTask | null = useMemo(() => {
    if (bankQuestion) return toTrainingTask(bankQuestion);
    if (isDesktop && loadingTask) return null;
    return toDemoTrainingTask(initialId);
  }, [bankQuestion, loadingTask, initialId]);

  const save = (status: "draft" | "submitted") =>
    runAction({
      setBusy: setIsSaving,
      notify,
      fallbackError: "作答保存失败",
      work: async () => {
        if (!task) return;
        if (!isDesktop) {
          if (status === "submitted") {
            setSubmitted(true);
            onSubmit();
          }
          return;
        }
        const next = await api().practice.saveResponse({
          sessionId: session?.id,
          referenceKey: task.id,
          title: task.heading,
          answerFormat: "keyboard",
          content: answer,
          status,
        });
        setSession(next);
        if (status === "submitted") {
          setSubmitted(true);
          onSubmit();
        } else notify("草稿已写入本地档案");
      },
    });
  const attachPaper = () =>
    runAction({
      setBusy: setIsSaving,
      notify,
      fallbackError: "纸质答案归档失败",
      work: async () => {
        if (!task) return;
        const result = await api().practice.selectPaperAttachments({
          sessionId: session?.id,
          referenceKey: task.id,
          title: task.heading,
        });
        if (result.session) {
          setSession(result.session);
          notify("纸质答案已归档到本次作答");
        }
      },
    });
  const saveInk = (
    payload: {
      canvasWidth: number;
      canvasHeight: number;
      previewSvg: string;
      layers: MyEuclidInkLayer[];
    },
    status: "draft" | "submitted"
  ) =>
    runAction({
      setBusy: setIsSaving,
      notify,
      fallbackError: "笔迹保存失败",
      work: async () => {
        if (!task) return;
        const result = await api().practice.saveInkResponse({
          sessionId: session?.id,
          referenceKey: task.id,
          title: task.heading,
          status,
          ...payload,
        });
        setSession(result.session);
        if (status === "submitted") {
          setSubmitted(true);
          onSubmit();
        } else notify("笔迹草稿已写入本地档案");
      },
    });
  const attachmentCount =
    session?.responses.flatMap(response => response.attachments).length ?? 0;
  if (!task)
    return (
      <div className="training-view">
        <button className="back-link" onClick={backToLibrary}>
          <ArrowLeft size={16} /> 返回题库档案
        </button>
        <div className="review-loading">正在读取题目…</div>
      </div>
    );
  return (
    <div className="training-view">
      <button className="back-link" onClick={backToLibrary}>
        <ArrowLeft size={16} /> 返回题库档案
      </button>
      <div className="training-top">
        <div>
          <p className="eyebrow">TRAINING SESSION · {task.id}</p>
          <h2>{task.heading}</h2>
        </div>
        <SessionClock />
      </div>
      <div className="training-grid">
        <article className="problem-sheet">
          <div className="sheet-label">
            <span>题面</span>
            <small>{task.note}</small>
          </div>
          <h3>{task.title}</h3>
          <MathText text={task.promptText} className="problem-prompt" />
          {task.kind === "bank" && task.subquestions.length > 0 && (
            <ol className="problem-subquestions">
              {task.subquestions.map(sub => (
                <li key={sub.id}>
                  <MathText text={`${sub.label} ${sub.promptText}`} />
                </li>
              ))}
            </ol>
          )}
          {task.kind === "demo" && (
            <div className="math-block">
              a<sub>n+1</sub> = f(a<sub>n</sub>), &nbsp; n ∈ ℕ<sup>+</sup>
            </div>
          )}
          <div className="sheet-tags">
            {task.tags.map(tag => (
              <span key={tag} className="tag">
                {tag}
              </span>
            ))}
            <span className="tag proof-tag">需要完整证明</span>
          </div>
        </article>
        <aside className="answer-panel">
          <div className="answer-head">
            <div>
              <p className="eyebrow">YOUR WORK</p>
              <h3>作答记录</h3>
            </div>
            <span className="autosave">
              {session ? (
                <>
                  <CheckCircle2 size={14} /> 已保存 {session.responses.length}{" "}
                  个版本
                </>
              ) : (
                "尚未保存"
              )}
            </span>
          </div>
          <div className="answer-modes">
            {answerModes.map(({ id, label }) => (
              <button
                key={id}
                className={mode === id ? "is-selected" : ""}
                onClick={() => setMode(id)}
              >
                {id === "keyboard" ? (
                  <Keyboard size={15} />
                ) : id === "ink" ? (
                  <MousePointer2 size={15} />
                ) : (
                  <ImageUp size={15} />
                )}
                {label}
              </button>
            ))}
          </div>
          {mode === "paper" ? (
            <div className="input-placeholder">
              <ImageUp size={26} />
              <strong>纸质答案附件</strong>
              <p>
                选择
                PDF、扫描件或照片后，文件会复制到本地档案，并绑定到本次作答。
              </p>
              <button onClick={() => void attachPaper()} disabled={isSaving}>
                {isSaving ? "正在归档…" : "选择纸质答案"}
              </button>
              {attachmentCount ? (
                <small>已关联 {attachmentCount} 个附件</small>
              ) : null}
            </div>
          ) : mode === "ink" ? (
            <InkCanvas onSave={saveInk} isSaving={isSaving} />
          ) : (
            <>
              <textarea
                value={answer}
                onChange={event => setAnswer(event.target.value)}
                onBlur={() => void save("draft")}
                placeholder="在这里写下证明。公式可以使用 LaTeX 语法，例如 $\frac{a}{b}$，保存后会以数学排版显示。"
              />
              <p className="session-hint">
                离开输入框会自动存草稿；每次保存均保留为独立版本。
              </p>
            </>
          )}
          {mode === "keyboard" && (
            <div className="answer-actions">
              <button
                className="secondary-button"
                onClick={() => setAnswer("")}
              >
                <Undo2 size={15} /> 清空草稿
              </button>
              <button
                className="secondary-button"
                onClick={() => void save("draft")}
                disabled={isSaving}
              >
                <Save size={15} /> 保存草稿
              </button>
              <button
                className="primary-button"
                onClick={() => void save("submitted")}
                disabled={isSaving}
              >
                <Send size={15} /> 提交并分析
              </button>
            </div>
          )}
          {submitted && (
            <div className="assessment-card">
              <div>
                <p className="eyebrow">ASSESSMENT ARCHIVE</p>
                <h4>作答已进入本地评分档案</h4>
              </div>
              <span>等待评分确认</span>
              <p>
                可在“错题证据”中为本次作答建立可回看的评分依据、错因和模块拆分。AI
                判卷须待服务与密钥由你主动配置后才会启用。
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
