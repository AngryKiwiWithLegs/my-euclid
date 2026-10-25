/**
 * 欧几里得档案室：题库发布必须由审核后的草案与人工训练元数据共同构成。
 * 页面只调用受限本地 IPC；来源、题面和小问均保持到原始 OCR 草案的回链。
 */
import { Send, X } from "lucide-react";
import { useEffect, useState } from "react";
import { api, isDesktop } from "@/lib/api";
import "./QuestionPublishPanel.css";
import { useNotify } from "@/lib/toast";

type PublishDraft = MyEuclidQuestionPublishInput["metadata"];
const split = (value: string) =>
  value
    .split(/[，,、]/)
    .map(item => item.trim())
    .filter(Boolean);
const initial = (draft: MyEuclidQuestionDraft): PublishDraft => ({
  sourceName: "Euclid",
  competitionYear: undefined,
  questionNumber: undefined,
  primaryTopic: "",
  secondaryTopics: [],
  difficulty: 3,
  questionType: "证明",
  methods: [],
  proofRequired: false,
  estimatedMinutes: undefined,
  maximumPoints: undefined,
  scoringNotes: "",
  priority: 0,
  tags: [],
  subquestions: draft.subquestions.map(item => ({
    sourceSubquestionDraftId: item.id,
    ordinal: item.ordinal,
    label: item.label,
    promptText: item.text,
    maximumPoints: undefined,
  })),
});

export function QuestionPublishPanel({
  sourceDocumentId,
  drafts,
  onPublished,
  onClose,
}: {
  sourceDocumentId: string;
  drafts: MyEuclidQuestionDraft[];
  onPublished: () => Promise<void>;
  onClose: () => void;
}) {
  const notify = useNotify();
  const [metadata, setMetadata] = useState<Record<string, PublishDraft>>({});
  const [busy, setBusy] = useState(false);
  // 仅在切换资料时初始化元数据；草案编辑（drafts 引用变化）不得重置用户已填写的字段。
  useEffect(() => {
    setMetadata(
      Object.fromEntries(
        drafts
          .filter(draft => draft.id)
          .map(draft => [draft.id!, initial(draft)])
      )
    );
  }, [sourceDocumentId]);
  const metaFor = (draft: MyEuclidQuestionDraft): PublishDraft =>
    metadata[draft.id!] ?? initial(draft);
  const update = (id: string, patch: Partial<PublishDraft>) =>
    setMetadata(current => {
      const draft = drafts.find(item => item.id === id);
      return {
        ...current,
        [id]: {
          ...(current[id] ?? (draft ? initial(draft) : ({} as PublishDraft))),
          ...patch,
        },
      };
    });
  const publish = async () => {
    if (!isDesktop) return;
    try {
      const inputs = drafts
        .filter(draft => draft.id)
        .map(draft => ({
          questionDraftId: draft.id!,
          metadata: metaFor(draft),
        }));
      if (!inputs.length)
        throw new Error("请先确认题目与小问切分，再发布正式题库。");
      setBusy(true);
      await api().review.publishQuestionDrafts(sourceDocumentId, inputs);
      await onPublished();
      onClose();
      notify(
        `已发布 ${inputs.length} 道正式题目；来源、页码、小问与标签均可回链。`
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : "题库发布失败。");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="question-publish-panel">
      <div className="publish-panel-head">
        <div>
          <p className="eyebrow">PUBLISH TO QUESTION BANK</p>
          <h3>补全训练元数据</h3>
        </div>
        <button className="text-action" onClick={onClose} disabled={busy}>
          <X size={15} /> 关闭
        </button>
      </div>
      <p className="publish-note">
        发布不会复制或覆盖原件；每个正式题目均回链到已确认草案、原始资料与页面。必填项为来源、主考点和题型。
      </p>
      {drafts
        .filter(draft => draft.id)
        .map(draft => {
          const meta = metaFor(draft);
          return (
            <article className="publish-question-card" key={draft.id}>
              <div className="publish-question-title">
                <span>{draft.label}</span>
                <div>
                  <strong>{draft.title || "未命名题目"}</strong>
                  <small>
                    原页关联：{draft.pageId.slice(0, 8)}… · 小问{" "}
                    {draft.subquestions.length}
                  </small>
                </div>
              </div>
              <div className="publish-grid">
                <label>
                  来源 *
                  <input
                    value={meta.sourceName}
                    onChange={event =>
                      update(draft.id!, { sourceName: event.target.value })
                    }
                    placeholder="例如：Euclid"
                  />
                </label>
                <label>
                  年份
                  <input
                    type="number"
                    value={meta.competitionYear ?? ""}
                    onChange={event =>
                      update(draft.id!, {
                        competitionYear: event.target.value
                          ? Number(event.target.value)
                          : undefined,
                      })
                    }
                    placeholder="例如：2025"
                  />
                </label>
                <label>
                  题号
                  <input
                    type="number"
                    value={meta.questionNumber ?? ""}
                    onChange={event =>
                      update(draft.id!, {
                        questionNumber: event.target.value
                          ? Number(event.target.value)
                          : undefined,
                      })
                    }
                    placeholder="例如：7"
                  />
                </label>
                <label>
                  主考点 *
                  <input
                    value={meta.primaryTopic}
                    onChange={event =>
                      update(draft.id!, { primaryTopic: event.target.value })
                    }
                    placeholder="例如：数列与递推"
                  />
                </label>
                <label>
                  题型 *
                  <input
                    value={meta.questionType}
                    onChange={event =>
                      update(draft.id!, { questionType: event.target.value })
                    }
                    placeholder="例如：证明"
                  />
                </label>
                <label>
                  难度（1–5）
                  <select
                    value={meta.difficulty ?? ""}
                    onChange={event =>
                      update(draft.id!, {
                        difficulty: event.target.value
                          ? Number(event.target.value)
                          : undefined,
                      })
                    }
                  >
                    <option value="">未设定</option>
                    {[1, 2, 3, 4, 5].map(value => (
                      <option value={value} key={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  预计用时（分钟）
                  <input
                    type="number"
                    min="1"
                    max="300"
                    value={meta.estimatedMinutes ?? ""}
                    onChange={event =>
                      update(draft.id!, {
                        estimatedMinutes: event.target.value
                          ? Number(event.target.value)
                          : undefined,
                      })
                    }
                  />
                </label>
                <label>
                  满分
                  <input
                    type="number"
                    min="0.5"
                    max="100"
                    step="0.5"
                    value={meta.maximumPoints ?? ""}
                    onChange={event =>
                      update(draft.id!, {
                        maximumPoints: event.target.value
                          ? Number(event.target.value)
                          : undefined,
                      })
                    }
                  />
                </label>
                <label className="span-two">
                  次考点（逗号分隔）
                  <input
                    value={meta.secondaryTopics.join("，")}
                    onChange={event =>
                      update(draft.id!, {
                        secondaryTopics: split(event.target.value),
                      })
                    }
                    placeholder="例如：归纳，不变量"
                  />
                </label>
                <label className="span-two">
                  常用方法（逗号分隔）
                  <input
                    value={meta.methods.join("，")}
                    onChange={event =>
                      update(draft.id!, { methods: split(event.target.value) })
                    }
                    placeholder="例如：构造，反证法"
                  />
                </label>
                <label className="span-two">
                  自定义标签（格式：类别:值，逗号分隔）
                  <input
                    value={meta.tags
                      .map(tag => `${tag.category}:${tag.value}`)
                      .join("，")}
                    onChange={event =>
                      update(draft.id!, {
                        tags: split(event.target.value).map(value => {
                          const [category, ...rest] = value.split(":");
                          return {
                            category: category.trim() || "自定义",
                            value: rest.join(":").trim() || category.trim(),
                          };
                        }),
                      })
                    }
                    placeholder="例如：考点:数论，优先级:错题"
                  />
                </label>
                <label className="span-two">
                  得分点与评分备注
                  <textarea
                    value={meta.scoringNotes}
                    onChange={event =>
                      update(draft.id!, { scoringNotes: event.target.value })
                    }
                    placeholder="记录关键得分点、证明完整性要求或评分注意事项。"
                  />
                </label>
                <label className="proof-check">
                  <input
                    type="checkbox"
                    checked={meta.proofRequired}
                    onChange={event =>
                      update(draft.id!, { proofRequired: event.target.checked })
                    }
                  />{" "}
                  需要完整证明
                </label>
                <label className="priority-select">
                  训练优先级
                  <select
                    value={meta.priority}
                    onChange={event =>
                      update(draft.id!, {
                        priority: Number(event.target.value),
                      })
                    }
                  >
                    {[0, 1, 2, 3, 4, 5].map(value => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {draft.subquestions.length > 0 && (
                <div className="publish-subs">
                  <strong>小问与对应来源</strong>
                  {draft.subquestions.map(sub => (
                    <div key={sub.id ?? `${sub.ordinal}-${sub.label}`}>
                      <span>{sub.label}</span>
                      <small>{sub.text || "未填写小问文本"}</small>
                    </div>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      <div className="publish-actions">
        <button className="secondary-button" onClick={onClose} disabled={busy}>
          返回审核
        </button>
        <button
          className="primary-button"
          onClick={() => void publish()}
          disabled={busy || !drafts.some(draft => draft.id)}
        >
          <Send size={15} /> {busy ? "正在发布…" : "发布到正式题库"}
        </button>
      </div>
    </section>
  );
}
