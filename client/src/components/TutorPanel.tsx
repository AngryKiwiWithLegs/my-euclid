/** 欧几里得档案室：互动讲解点击即生成；发送范围（题面文本）在面板内透明展示，不再作为人工关卡。 */
import { BrainCircuit, RefreshCw, Send, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import "./TutorPanel.css";

export function TutorPanel({ question, close, notify }: { question: MyEuclidQuestionBankQuestion; close: () => void; notify: (text: string) => void }) {
  const [session, setSession] = useState<MyEuclidTutorSession | null>(null);
  const [providerInfo, setProviderInfo] = useState<{ label: string; model: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questionText, setQuestionText] = useState("");
  const generate = async () => {
    if (!window.myEuclid) { setError("浏览器预览不访问本地题库，请在桌面版中使用讲解。"); return; }
    try {
      setBusy(true);
      setError(null);
      const preview = await window.myEuclid.ai.prepareTutor({ questionId: question.id });
      setProviderInfo({ label: preview.providerLabel, model: preview.model });
      setSession(await window.myEuclid.ai.runTutor(preview.authorizationToken));
    } catch (err) {
      const message = err instanceof Error ? err.message : "互动讲解生成失败。";
      setError(message);
      notify(message);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => { void generate(); }, []);
  const ask = async () => {
    if (!window.myEuclid || !session || !questionText.trim()) return;
    try {
      setBusy(true);
      setSession(await window.myEuclid.ai.askTutor({ sessionId: session.id, message: questionText }));
      setQuestionText("");
    } catch (error) {
      notify(error instanceof Error ? error.message : "互动讲解追问失败。");
    } finally {
      setBusy(false);
    }
  };
  return <div className="tutor-overlay" role="dialog" aria-modal="true"><section className="tutor-panel"><button className="icon-button tutor-close" onClick={close}><X size={18} /></button><p className="eyebrow">SOCRATIC AI TUTOR</p><h3>{session ? "三种方法讲解计划" : error ? "讲解生成失败" : "正在生成讲解…"}</h3><p className="tutor-provider">{providerInfo ? `本次由 ${providerInfo.label} · ${providerInfo.model} 生成；仅发送已发布题面的文本内容，不上传原件、扫描图或附件。` : "将只发送本题题面文本给默认 AI 服务，不上传原件、扫描图或附件。"}</p>{error && <div className="tutor-error"><strong>生成失败：</strong>{error}<button className="secondary-button" disabled={busy} onClick={() => void generate()}><RefreshCw size={14} /> 重试</button></div>}{busy && !session && <div className="tutor-loading"><Sparkles size={18} /> 正在请求 AI 生成“必备知识—切入点—三种方法—同类题—变式—追问”讲解，通常需要十几秒…</div>}{session?.plan && <div className="tutor-result"><p><strong>必备知识：</strong>{session.plan.prerequisiteKnowledge.join("、") || "由题面直接引导"}</p><p><strong>从这里入手：</strong>{session.plan.entryPoint}</p><p><strong>怎么想到：</strong>{session.plan.thoughtSource}</p><div className="tutor-methods">{session.plan.methods.map((method, index) => <article key={`${method.name}-${index}`}><span>方法 {index + 1}</span><h4>{method.name}</h4><p>{method.outline}</p><small><strong>关键：</strong>{method.keyIdea}</small><small><strong>误区：</strong>{method.pitfalls}</small></article>)}</div><p><strong>同类题：</strong>{session.plan.similarType}</p><p><strong>变式：</strong>{session.plan.variants.join("；")}</p><div className="tutor-question"><BrainCircuit size={18} /><p>{session.plan.socraticQuestion}</p></div><div className="tutor-chat">{session.messages.map(item => <p key={item.id} className={item.role}><strong>{item.role === "user" ? "你" : "导师"}：</strong>{item.content}</p>)}<textarea value={questionText} onChange={event => setQuestionText(event.target.value)} placeholder="写下你的下一步尝试或追问…" /><button className="secondary-button" disabled={busy || !questionText.trim()} onClick={() => void ask()}><Send size={14} /> 提交追问</button></div></div>}</section></div>;
}