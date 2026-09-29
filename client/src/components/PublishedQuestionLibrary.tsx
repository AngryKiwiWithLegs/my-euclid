/** 欧几里得档案室：正式题库显示可回链题目，并在桌面端提供逐次授权的互动讲解入口。 */
import {
  BookOpenCheck,
  ChevronRight,
  Filter,
  Search,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api, isDesktop } from "@/lib/api";
import { TutorPanel } from "./TutorPanel";

export function PublishedQuestionLibrary({
  openTraining,
  openReview,
}: {
  openTraining: (id: string) => void;
  openReview: () => void;
}) {
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("全部模块");
  const [rows, setRows] = useState<MyEuclidQuestionBankQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [tutorQuestion, setTutorQuestion] =
    useState<MyEuclidQuestionBankQuestion | null>(null);
  const [variantBusy, setVariantBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const refresh = async () => {
    if (!isDesktop) return;
    setLoading(true);
    try {
      setRows(
        await api().library.listQuestions({
          query,
          primaryTopic: topic === "全部模块" ? undefined : topic,
        })
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "读取本地题库失败。");
    } finally {
      setLoading(false);
    }
  };
  const generateVariant = async (row: MyEuclidQuestionBankQuestion) => {
    if (!isDesktop) return;
    try {
      setVariantBusy(row.id);
      setNotice(`正在为「${row.title || row.label}」生成 AI 变式题…`);
      const created = await api().ai.generateVariants({
        questionId: row.id,
        count: 1,
      });
      setNotice(
        created.length
          ? `AI 变式题「${created[0].title || created[0].label}」已生成并发布到题库。`
          : "AI 未返回变式题。"
      );
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "AI 变式生成失败");
    } finally {
      setVariantBusy(null);
    }
  };
  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 100);
    return () => window.clearTimeout(timer);
  }, [query, topic]);
  const topics = useMemo(
    () => [
      "全部模块",
      ...Array.from(new Set(rows.map(row => row.primaryTopic).filter(Boolean))),
    ],
    [rows]
  );
  return (
    <>
      <div className="library-toolbar">
        <label className="search-box">
          <Search size={16} />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="搜索题号、来源、知识点、方法"
          />
        </label>
        <label className="filter-select">
          <Filter size={15} />
          <select
            value={topic}
            onChange={event => setTopic(event.target.value)}
          >
            {topics.map(item => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <span className="result-count">
          {loading ? "正在读取本地题库…" : `${rows.length} 道已发布题目`}
        </span>
      </div>
      {notice && <p className="form-note">{notice}</p>}
      {rows.length ? (
        <div className="library-table">
          <div className="table-head">
            <span>来源 / 题目</span>
            <span>标签</span>
            <span>难度</span>
            <span>状态</span>
            <span />
          </div>
          {rows.map(row => (
            <article className="library-row" key={row.id}>
              <div>
                <p className="record-id">
                  {row.sourceName} · {row.competitionYear ?? "—"} · {row.label}
                </p>
                <h4>{row.title || row.label}</h4>
                <small>
                  原件：{row.originalName} · 第 {row.pageNumber} 页 ·{" "}
                  {row.subquestions.length} 个小问
                </small>
              </div>
              <div>
                {[row.primaryTopic, ...row.secondaryTopics, ...row.methods]
                  .filter(Boolean)
                  .slice(0, 5)
                  .map(tag => (
                    <span className="tag" key={tag}>
                      {tag}
                    </span>
                  ))}
              </div>
              <span className="difficulty-dot">
                <i />
                {row.difficulty ? `${row.difficulty} / 5` : "未设定"}
              </span>
              <span className="status-pill">已发布</span>
              <div className="library-actions">
                {isDesktop && (
                  <button
                    className="text-action"
                    disabled={variantBusy === row.id}
                    onClick={() => void generateVariant(row)}
                  >
                    <Sparkles size={14} />{" "}
                    {variantBusy === row.id ? "生成中…" : "AI 变式"}
                  </button>
                )}
                <button
                  className="text-action"
                  onClick={() => setTutorQuestion(row)}
                >
                  <Sparkles size={14} /> 讲解
                </button>
                <button
                  className="row-action"
                  onClick={() => openTraining(row.id)}
                >
                  训练 <ChevronRight size={15} />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="review-empty">
          <BookOpenCheck size={28} />
          <h3>还没有已发布的真实题目。</h3>
          <p>
            在“审核工作台”确认题目与小问切分后，补全来源、考点、难度、方法和得分点，即可发布到这里。
          </p>
          <button className="secondary-button" onClick={openReview}>
            前往审核工作台
          </button>
        </div>
      )}
      {tutorQuestion && (
        <TutorPanel
          question={tutorQuestion}
          close={() => setTutorQuestion(null)}
          notify={setNotice}
        />
      )}
    </>
  );
}
