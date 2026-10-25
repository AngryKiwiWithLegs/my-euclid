/**
 * 欧几里得档案室：互动讲解保留人工关卡——先在本地建立发送范围预览（不联网），
 * 用户确认后才会向默认 AI 服务发起一次请求；追问由用户逐次发送，天然是逐次授权。
 */
import {
  BrainCircuit,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { api, isDesktop, toUserMessage } from "@/lib/api";
import "./TutorPanel.css";
import { useNotify } from "@/lib/toast";

export function TutorPanel({
  question,
  close,
}: {
  question: MyEuclidQuestionBankQuestion;
  close: () => void;
}) {
  const notify = useNotify();
  const [preview, setPreview] = useState<MyEuclidTutorPreview | null>(null);
  const [session, setSession] = useState<MyEuclidTutorSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questionText, setQuestionText] = useState("");
  const prepare = async () => {
    if (!isDesktop) {
      setError("浏览器预览不访问本地题库，请在桌面版中使用讲解。");
      return;
    }
    setError(null);
    setSession(null);
    try {
      setBusy(true);
      setPreview(await api().ai.prepareTutor({ questionId: question.id }));
    } catch (err) {
      const message = toUserMessage(err, "互动讲解预览失败。");
      setError(message);
      notify(message);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    void prepare();
  }, []);
  const run = async () => {
    if (!preview) return;
    try {
      setBusy(true);
      setError(null);
      setSession(await api().ai.runTutor(preview.authorizationToken));
      setPreview(null);
    } catch (err) {
      setError(toUserMessage(err, "互动讲解生成失败。"));
    } finally {
      setBusy(false);
    }
  };
  const ask = async () => {
    if (!isDesktop || !session || !questionText.trim()) return;
    try {
      setBusy(true);
      setSession(
        await api().ai.askTutor({
          sessionId: session.id,
          message: questionText,
        })
      );
      setQuestionText("");
    } catch (error) {
      notify(toUserMessage(error, "互动讲解追问失败。"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="tutor-overlay" role="dialog" aria-modal="true">
      <section className="tutor-panel">
        <button className="icon-button tutor-close" onClick={close}>
          <X size={18} />
        </button>
        <p className="eyebrow">SOCRATIC AI TUTOR</p>
        <h3>
          {session
            ? "三种方法讲解计划"
            : error
              ? "讲解生成失败"
              : "请确认本次发送范围"}
        </h3>
        {preview && !session && (
          <div className="tutor-authorize">
            <div className="tutor-authorize-head">
              <ShieldCheck size={18} />
              <div>
                <strong>
                  本次将由 {preview.providerLabel} · {preview.model} 生成讲解
                </strong>
                <p>{preview.disclosure.join(" ")}</p>
              </div>
            </div>
            <div className="tutor-authorize-content">
              <strong>将发送的题面文本</strong>
              <pre>{preview.questionText}</pre>
            </div>
            <div className="tutor-authorize-actions">
              <button className="secondary-button" onClick={close}>
                取消
              </button>
              <button
                className="primary-button"
                disabled={busy}
                onClick={() => void run()}
              >
                <Sparkles size={15} />{" "}
                {busy ? "正在请求并校验…" : "确认发送并生成讲解"}
              </button>
            </div>
          </div>
        )}
        {!preview && !session && (
          <div className="tutor-error">
            {error ? (
              <>
                <strong>生成失败：</strong>
                {error}
              </>
            ) : (
              "正在准备发送范围预览…"
            )}
            {error && (
              <button
                className="secondary-button"
                disabled={busy}
                onClick={() => void prepare()}
              >
                <RefreshCw size={14} /> 重新查看发送范围
              </button>
            )}
          </div>
        )}
        {busy && !session && preview && (
          <div className="tutor-loading">
            <Sparkles size={18} /> 正在请求 AI
            生成“必备知识—切入点—三种方法—同类题—变式—追问”讲解，通常需要十几秒…
          </div>
        )}
        {session?.plan && (
          <div className="tutor-result">
            <p>
              <strong>必备知识：</strong>
              {session.plan.prerequisiteKnowledge.join("、") ||
                "由题面直接引导"}
            </p>
            <p>
              <strong>从这里入手：</strong>
              {session.plan.entryPoint}
            </p>
            <p>
              <strong>怎么想到：</strong>
              {session.plan.thoughtSource}
            </p>
            <div className="tutor-methods">
              {session.plan.methods.map((method, index) => (
                <article key={`${method.name}-${index}`}>
                  <span>方法 {index + 1}</span>
                  <h4>{method.name}</h4>
                  <p>{method.outline}</p>
                  <small>
                    <strong>关键：</strong>
                    {method.keyIdea}
                  </small>
                  <small>
                    <strong>误区：</strong>
                    {method.pitfalls}
                  </small>
                </article>
              ))}
            </div>
            <p>
              <strong>同类题：</strong>
              {session.plan.similarType}
            </p>
            <p>
              <strong>变式：</strong>
              {session.plan.variants.join("；")}
            </p>
            <div className="tutor-question">
              <BrainCircuit size={18} />
              <p>{session.plan.socraticQuestion}</p>
            </div>
            <div className="tutor-chat">
              {session.messages.map(item => (
                <p key={item.id} className={item.role}>
                  <strong>{item.role === "user" ? "你" : "导师"}：</strong>
                  {item.content}
                </p>
              ))}
              <textarea
                value={questionText}
                onChange={event => setQuestionText(event.target.value)}
                placeholder="写下你的下一步尝试或追问…"
              />
              <button
                className="secondary-button"
                disabled={busy || !questionText.trim()}
                onClick={() => void ask()}
              >
                <Send size={14} /> 提交追问
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
