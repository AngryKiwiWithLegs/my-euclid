/** 审核工作台：OCR 修订、区域框选识别、题目切分与发布入口；AI 自动审核默认关闭，由用户显式开启。 */
import { useEffect, useState } from "react";
import {
  Archive,
  Check,
  CheckCircle2,
  FileSearch,
  FileText,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
import { OcrRegionSelector } from "@/components/OcrRegionSelector";
import { QuestionPublishPanel } from "@/components/QuestionPublishPanel";
import { api, isDesktop, runAction, toUserMessage } from "@/lib/api";
import { STORAGE_KEYS, readLocalFlag, writeLocalFlag } from "@/lib/constants";
import { SectionTitle } from "./shared";
import { useNotify } from "@/lib/toast";

export function ReviewWorkbench({
  documents,
  refreshDocuments,
}: {
  documents: MyEuclidReviewDocumentSummary[];
  refreshDocuments: () => Promise<void>;
}) {
  const notify = useNotify();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MyEuclidReviewDocumentDetail | null>(
    null
  );
  const [pageId, setPageId] = useState<string | null>(null);
  const [pageText, setPageText] = useState("");
  const [drafts, setDrafts] = useState<MyEuclidQuestionDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagePreview, setPagePreview] =
    useState<MyEuclidReviewPagePreview | null>(null);
  const [recognizingRegion, setRecognizingRegion] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [savingDrafts, setSavingDrafts] = useState(false);
  const [savingPage, setSavingPage] = useState(false);
  const [autoBusy, setAutoBusy] = useState(false);
  const [autoOn, setAutoOn] = useState(() =>
    readLocalFlag(STORAGE_KEYS.autoReview, false)
  );

  const toggleAuto = () => {
    const next = !autoOn;
    writeLocalFlag(STORAGE_KEYS.autoReview, next);
    setAutoOn(next);
    notify(
      next
        ? "已开启：导入后自动 AI 审核并发布，全程无需点击。"
        : "已关闭：导入后需在此手动触发审核。"
    );
  };

  const runAutoReview = () =>
    runAction({
      setBusy: setAutoBusy,
      notify,
      fallbackError: "AI 自动审核失败",
      work: async () => {
        notify(
          "AI 自动审核已启动：正在校对 OCR、切分并发布到题库，可能需要几分钟，请保持网络畅通。",
          15000
        );
        const summary = await api().ai.autoReviewAll();
        const detailText = summary.documents
          .map(
            item =>
              `《${item.originalName}》校对 ${item.pagesReviewed} 页、发布 ${item.questionsPublished} 题${item.warnings?.length ? `（警告：${item.warnings.join("；")}）` : ""}`
          )
          .join("；");
        notify(
          `AI 自动审核完成（${summary.providerLabel} · ${summary.model}）：${detailText || "无资料被处理"}${summary.failures.length ? `；未完成 → ${summary.failures.join("；")}` : ""}`,
          20000
        );
        await refreshDocuments();
        if (selectedId) {
          const next = await api().review.getDocument(selectedId);
          if (next) {
            setDetail(next);
            setDrafts(next.questions ?? []);
          }
        }
      },
    });

  useEffect(() => {
    if (!selectedId && documents[0])
      setSelectedId(documents[0].sourceDocumentId);
  }, [documents, selectedId]);
  useEffect(() => {
    if (!selectedId || !isDesktop) return;
    void (async () => {
      try {
        setLoading(true);
        const next = await api().review.getDocument(selectedId);
        setDetail(next);
        setPageId(next?.pages[0]?.id ?? null);
        setPageText(next?.pages[0]?.ocrText ?? "");
        setDrafts(next?.questions ?? []);
      } catch (error) {
        notify(toUserMessage(error, "读取审核档案失败"));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);
  const activePage = detail?.pages.find(page => page.id === pageId) ?? null;
  useEffect(() => {
    let cancelled = false;
    setPagePreview(null);
    if (!pageId || !isDesktop)
      return () => {
        cancelled = true;
      };
    void (async () => {
      try {
        const preview = await api().review.getPagePreview(pageId);
        if (!cancelled) setPagePreview(preview);
      } catch (error) {
        if (!cancelled)
          setPagePreview({
            pageId,
            pageNumber: activePage?.pageNumber ?? 0,
            sourceKind: "text",
            available: false,
            reason: toUserMessage(error, "无法生成本地页面预览。"),
          });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId]);
  const selectPage = (nextPageId: string) => {
    setPageId(nextPageId);
    setPageText(
      detail?.pages.find(page => page.id === nextPageId)?.ocrText ?? ""
    );
  };
  const savePage = () =>
    runAction({
      setBusy: setSavingPage,
      notify,
      fallbackError: "本页 OCR 保存失败",
      work: async () => {
        if (!pageId || !selectedId) throw new Error("请先选择要保存的页面。");
        await api().review.updatePageOcr(pageId, pageText);
        const next = await api().review.getDocument(selectedId);
        setDetail(next);
        await refreshDocuments();
        notify("本页 OCR 文本已保存并标记为已审核");
      },
    });
  const addQuestion = () => {
    if (!detail?.pages[0]) return;
    setDrafts(current => [
      ...current,
      {
        pageId: activePage?.id ?? detail.pages[0].id,
        label: `第 ${current.length + 1} 题`,
        title: "未命名题目",
        promptText: activePage?.ocrText ?? "",
        ordinal: current.length + 1,
        subquestions: [],
      },
    ]);
  };
  const updateDraft = (
    index: number,
    key: keyof Omit<MyEuclidQuestionDraft, "subquestions">,
    value: string | number
  ) =>
    setDrafts(current =>
      current.map((draft, draftIndex) =>
        draftIndex === index ? { ...draft, [key]: value } : draft
      )
    );
  const saveDrafts = () =>
    runAction({
      setBusy: setSavingDrafts,
      notify,
      fallbackError: "题目草案保存失败。请检查每道题的题号、题面文本和来源页。",
      work: async () => {
        if (!selectedId) throw new Error("请先选择资料。");
        const invalidDraft = drafts.find(
          draft => !draft.label.trim() || !draft.promptText.trim()
        );
        if (invalidDraft)
          throw new Error("请为每道题填写题号与题面文本后再确认写入题目档案。");
        await api().review.saveQuestionDrafts(selectedId, drafts);
        const next = await api().review.getDocument(selectedId);
        if (!next)
          throw new Error(
            "题目草案已保存，但无法重新读取当前资料。请重新打开审核工作台确认。"
          );
        setDetail(next);
        setDrafts(next.questions);
        await refreshDocuments();
        notify("题目与小问切分已确认并写入本地档案。");
      },
    });
  const recognizeRegion = (rect: MyEuclidNormalizedRect) =>
    runAction({
      setBusy: setRecognizingRegion,
      notify,
      fallbackError: "局部 OCR 失败",
      work: async () => {
        if (!pageId || !selectedId) throw new Error("请先选择页面。");
        await api().review.recognizeRegion({ pageId, rect });
        const next = await api().review.getDocument(selectedId);
        setDetail(next);
        await refreshDocuments();
        notify("局部 OCR 已保存为独立证据；请审核后再采用文本。");
      },
    });
  const adoptRegionText = (text: string) => {
    if (!text.trim()) return;
    setPageText(current =>
      current.trim() ? `${current.trim()}\n\n${text.trim()}` : text.trim()
    );
    notify("局部识别文本已添加到编辑区；保存后才会确认本页 OCR。");
  };

  if (!isDesktop)
    return (
      <div className="view-shell">
        <SectionTitle eyebrow="REVIEW WORKBENCH" title="审核工作台" />
        <div className="review-empty">
          <FileSearch size={32} />
          <h3>浏览器预览不访问你的本地资料。</h3>
          <p>
            请通过 `pnpm dev:desktop`
            启动桌面版本，导入资料后在这里审核页面、OCR 文本、题目和小问。
          </p>
        </div>
      </div>
    );
  if (!documents.length)
    return (
      <div className="view-shell">
        <SectionTitle eyebrow="REVIEW WORKBENCH" title="审核工作台" />
        <div className="review-empty">
          <Archive size={32} />
          <h3>还没有待审核资料。</h3>
          <p>
            从“工作台”或“题库档案”导入
            PDF、图片或纸质答卷后，系统会在本地建立页面记录，并把它们列在这里。
          </p>
        </div>
      </div>
    );
  return (
    <div className="view-shell review-view">
      <SectionTitle
        eyebrow="LOCAL OCR · AI AUTO REVIEW"
        title="审核工作台"
        action={
          <span className="inline-actions">
            <button className="icon-label" onClick={toggleAuto}>
              <Zap size={14} /> 导入后自动审核：{autoOn ? "开" : "关"}
            </button>
            <button
              className="primary-button"
              disabled={autoBusy}
              onClick={() => void runAutoReview()}
            >
              <Sparkles size={15} />{" "}
              {autoBusy ? "AI 审核中…" : "立即 AI 审核补漏"}
            </button>
          </span>
        }
      />
      <div className="review-layout">
        <aside className="review-doc-list">
          <p className="eyebrow">待审核资料 · {documents.length}</p>
          {documents.map(document => (
            <button
              key={document.sourceDocumentId}
              className={
                selectedId === document.sourceDocumentId ? "is-selected" : ""
              }
              onClick={() => setSelectedId(document.sourceDocumentId)}
            >
              <FileText size={16} />
              <span>
                <strong>{document.originalName}</strong>
                <small>
                  {document.kind === "paper_response" ? "纸质答卷" : "题目资料"}{" "}
                  · {document.pageCount} 页
                </small>
              </span>
              <i>
                {document.reviewStatus === "needs_review" ? "待审" : "已审"}
              </i>
            </button>
          ))}
        </aside>
        <section className="review-page-panel">
          {loading || !detail ? (
            <div className="review-loading">正在读取本地审核档案…</div>
          ) : (
            <>
              <div className="review-panel-head">
                <div>
                  <p className="eyebrow">PAGE REVIEW</p>
                  <h3>{detail.originalName}</h3>
                </div>
                <span className="status-pill">
                  {activePage?.ocrStatus === "failed"
                    ? "OCR 待重试"
                    : activePage?.ocrStatus === "pending"
                      ? "等待 OCR"
                      : "可人工确认"}
                </span>
              </div>
              <div className="page-tabs">
                {detail.pages.map(page => (
                  <button
                    key={page.id}
                    className={pageId === page.id ? "is-selected" : ""}
                    onClick={() => selectPage(page.id)}
                  >
                    P.{page.pageNumber}
                    <small>
                      {page.ocrStatus === "extracted"
                        ? "已提取"
                        : page.ocrStatus === "failed"
                          ? "失败"
                          : "待处理"}
                    </small>
                  </button>
                ))}
              </div>
              <div className="original-preview">
                <span className="page-watermark">
                  {activePage
                    ? String(activePage.pageNumber).padStart(2, "0")
                    : "—"}
                </span>
                <div>
                  <p className="eyebrow">ORIGINAL PAGE LINK</p>
                  <strong>原始页码已关联</strong>
                  <small>
                    拖拽框选的局部识别会单独留存，只有你点击采用并保存时才会进入本页人工
                    OCR。
                  </small>
                </div>
              </div>
              <OcrRegionSelector
                preview={pagePreview}
                regions={activePage?.regions ?? []}
                isBusy={recognizingRegion}
                onRecognize={recognizeRegion}
                onUseText={adoptRegionText}
              />
              <label className="ocr-editor">
                <span>
                  <strong>OCR 文本</strong>
                  <small>可直接修订识别错误，保存后保留为人工审核版。</small>
                </span>
                <textarea
                  value={pageText}
                  onChange={event => setPageText(event.target.value)}
                  placeholder="本地 OCR 提取的文本会显示在这里。"
                />
              </label>
              <div className="review-actions">
                <span>
                  {activePage?.reviewStatus === "confirmed" ? (
                    <>
                      <CheckCircle2 size={15} /> 已确认本页文本
                    </>
                  ) : (
                    "修改后请保存本页文本"
                  )}
                </span>
                <button
                  className="primary-button"
                  onClick={() => void savePage()}
                  disabled={savingPage}
                >
                  <Save size={15} /> {savingPage ? "正在保存…" : "保存本页 OCR"}
                </button>
              </div>
            </>
          )}
        </section>
        <section className="draft-panel">
          {detail && (
            <>
              <div className="review-panel-head">
                <div>
                  <p className="eyebrow">QUESTION BOUNDARIES</p>
                  <h3>题目与小问切分</h3>
                </div>
                <button className="icon-label" onClick={addQuestion}>
                  <Plus size={15} /> 新增题目
                </button>
              </div>
              <p className="draft-note">
                AI
                自动审核默认关闭；开启后会在导入时自动切分并发布题目。此面板用于查看与修订草案，修订后重新运行
                AI 审核即可再次发布。
              </p>
              <div className="draft-list">
                {drafts.map((draft, index) => (
                  <article
                    key={`${draft.id ?? "new"}-${index}`}
                    className="draft-card"
                  >
                    <div className="draft-card-head">
                      <span className="draft-index">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <input
                        value={draft.label}
                        onChange={event =>
                          updateDraft(index, "label", event.target.value)
                        }
                        aria-label="题号"
                      />
                      <button
                        className="remove-draft"
                        onClick={() =>
                          setDrafts(current =>
                            current.filter(
                              (_, draftIndex) => draftIndex !== index
                            )
                          )
                        }
                        aria-label="删除题目草案"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <input
                      className="draft-title"
                      value={draft.title}
                      onChange={event =>
                        updateDraft(index, "title", event.target.value)
                      }
                      aria-label="题目标题"
                    />
                    <textarea
                      value={draft.promptText}
                      onChange={event =>
                        updateDraft(index, "promptText", event.target.value)
                      }
                      aria-label="题目文本"
                    />
                    <label className="draft-page-select">
                      来源页
                      <select
                        value={draft.pageId}
                        onChange={event =>
                          updateDraft(index, "pageId", event.target.value)
                        }
                      >
                        {detail.pages.map(page => (
                          <option key={page.id} value={page.id}>
                            第 {page.pageNumber} 页
                          </option>
                        ))}
                      </select>
                    </label>
                  </article>
                ))}
                {!drafts.length && (
                  <div className="no-drafts">
                    <Sparkles size={17} /> 先新增一题，或等待后续自动切分建议。
                  </div>
                )}
              </div>
              <button
                className="primary-button wide-button"
                onClick={() => {
                  if (!drafts.length) {
                    notify("请先点击“新增题目”，再填写题号和题面文本后确认。");
                    return;
                  }
                  void saveDrafts();
                }}
                disabled={savingDrafts}
              >
                <Check size={15} />{" "}
                {savingDrafts
                  ? "正在确认…"
                  : drafts.length
                    ? "确认并写入题目档案"
                    : "先新增题目后确认"}
              </button>
              {drafts.some(draft => draft.id) && (
                <button
                  className="icon-label"
                  onClick={() => setPublishing(value => !value)}
                >
                  <CheckCircle2 size={14} />{" "}
                  {publishing
                    ? "收起手动发布选项"
                    : "手动发布选项（AI 已自动发布，一般无需使用）"}
                </button>
              )}
              {publishing && (
                <div className="publish-drawer">
                  <QuestionPublishPanel
                    sourceDocumentId={selectedId!}
                    drafts={drafts}
                    onClose={() => setPublishing(false)}
                    onPublished={async () => {
                      const next = await api().review.getDocument(selectedId!);
                      setDetail(next);
                      setDrafts(next?.questions ?? []);
                    }}
                  />
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
