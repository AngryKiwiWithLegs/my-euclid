/**
 * 欧几里得档案室：真实 AI 判卷必须先展示本次发送文本并获得单次确认。
 * AI 输出只生成可审计的本地草案，绝不自动计入报告。
 */
import { LockKeyhole, Send, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { api, isDesktop } from "@/lib/api";
import { answerFormatName } from "@/lib/ui";
import "./AiAssessmentWizard.css";

export function AiAssessmentWizard({
  sessions,
  onCreated,
  notify,
}: {
  sessions: MyEuclidPracticeSession[];
  onCreated: () => Promise<void>;
  notify: (message: string) => void;
}) {
  const [sessionId, setSessionId] = useState("");
  const [responseId, setResponseId] = useState("");
  const [scoreMaximum, setScoreMaximum] = useState(10);
  const [questionText, setQuestionText] = useState("");
  const [preview, setPreview] = useState<MyEuclidAiAssessmentPreview | null>(
    null
  );
  const [busy, setBusy] = useState(false);
  const session = sessions.find(item => item.id === sessionId);
  const responses = session?.responses ?? [];
  const prepare = async () => {
    if (!isDesktop) return;
    try {
      if (!sessionId || !responseId)
        throw new Error("请先选择一份本地训练会话和答卷版本。");
      if (!questionText.trim())
        throw new Error("请粘贴本题题面，再查看本次发送范围。");
      setBusy(true);
      setPreview(
        await api().ai.prepareAssessment({
          sessionId,
          responseId,
          questionText,
          scoreMaximum,
        })
      );
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "无法建立 AI 判卷授权预览。"
      );
    } finally {
      setBusy(false);
    }
  };
  const run = async () => {
    if (!isDesktop || !preview) return;
    try {
      setBusy(true);
      const result = await api().ai.runAssessment(preview.authorizationToken);
      setPreview(null);
      await onCreated();
      notify(
        `AI 评分草案已保存：${result.providerLabel} · ${result.model}。请审核后再确认写入报告。`
      );
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "AI 判卷未完成，未保存评分草案。"
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="ai-assessment-wizard">
      <div className="assessment-section-head">
        <div>
          <p className="eyebrow">EXPLICIT AI AUTHORIZATION</p>
          <h3>生成 AI 评分草案</h3>
        </div>
        <span className="status-pill">逐次确认</span>
      </div>
      <p className="assessment-note">
        不会在保存作答时自动调用
        AI。请先核对本次发送的题面、答卷文本和服务，再明确确认。输出只会生成待审核草案。
      </p>
      {!preview ? (
        <>
          <div className="assessment-source-select">
            <label>
              训练会话
              <select
                value={sessionId}
                onChange={event => {
                  const next = sessions.find(
                    item => item.id === event.target.value
                  );
                  setSessionId(event.target.value);
                  setResponseId(next?.responses[0]?.id ?? "");
                }}
              >
                <option value="">选择本地训练会话</option>
                {sessions.map(item => (
                  <option value={item.id} key={item.id}>
                    {item.title} · {item.responses.length} 个作答版本
                  </option>
                ))}
              </select>
            </label>
            <label>
              答卷版本
              <select
                value={responseId}
                onChange={event => setResponseId(event.target.value)}
              >
                <option value="">选择答卷版本</option>
                {responses.map(item => (
                  <option value={item.id} key={item.id}>
                    V{item.version} ·{" "}
                    {item.answerFormat === "keyboard"
                      ? "键盘"
                      : item.answerFormat === "handwritten"
                        ? "笔迹"
                        : "纸质附件"}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="assessment-text-field">
            <span>本题题面（仅发送这段文本）</span>
            <textarea
              value={questionText}
              onChange={event => setQuestionText(event.target.value)}
              placeholder="粘贴需要评分的题目与小问。不要粘贴与本题无关的个人信息。"
            />
          </label>
          <label className="ai-score-maximum">
            满分
            <input
              type="number"
              min="1"
              max="1000"
              value={scoreMaximum}
              onChange={event => setScoreMaximum(Number(event.target.value))}
            />
          </label>
          <button
            className="secondary-button ai-preview-button"
            disabled={busy}
            onClick={() => void prepare()}
          >
            <LockKeyhole size={15} />{" "}
            {busy ? "正在生成发送预览…" : "查看本次发送范围"}
          </button>
        </>
      ) : (
        <div className="ai-authorization-preview">
          <div className="authorization-head">
            <ShieldCheck size={18} />
            <div>
              <strong>请确认本次发送内容</strong>
              <p>
                授权将在{" "}
                {new Date(preview.expiresAt).toLocaleTimeString("zh-CN")}{" "}
                失效；确认后会向所列服务发起一次评分请求。
              </p>
            </div>
          </div>
          <dl>
            <div>
              <dt>服务</dt>
              <dd>{preview.providerLabel}</dd>
            </div>
            <div>
              <dt>模型</dt>
              <dd>{preview.model}</dd>
            </div>
            <div>
              <dt>答卷</dt>
              <dd>
                {preview.sessionTitle} ·{" "}
                {answerFormatName(preview.answerFormat)} · 满分{" "}
                {preview.scoreMaximum}
              </dd>
            </div>
            <div>
              <dt>附件</dt>
              <dd>
                {preview.attachments.length
                  ? `${preview.attachments.length} 个附件仅在本机保留，不上传`
                  : "无附件"}
              </dd>
            </div>
          </dl>
          <div className="authorization-content">
            <strong>题面文本</strong>
            <pre>{preview.questionText}</pre>
            <strong>答卷文本</strong>
            <pre>
              {preview.answerText ||
                "（本答卷版本没有可发送文本；不会尝试读取或上传附件。）"}
            </pre>
          </div>
          <ul>
            {preview.disclosure.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <div className="authorization-actions">
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => setPreview(null)}
            >
              取消本次授权
            </button>
            <button
              className="primary-button"
              disabled={busy}
              onClick={() => void run()}
            >
              <Send size={15} />{" "}
              {busy ? "正在请求并校验…" : "确认发送并生成评分草案"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
