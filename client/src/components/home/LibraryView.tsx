/** 题库档案视图：桌面端展示真实题库与导入台账；浏览器预览降级为演示表格。 */
import {
  Archive,
  Camera,
  CheckCircle2,
  ChevronRight,
  FileSearch,
  FileText,
  Filter,
  Search,
  Upload,
} from "lucide-react";
import { useState } from "react";
import { PublishedQuestionLibrary } from "@/components/PublishedQuestionLibrary";
import { demoTasks } from "@/lib/demoQuestions";
import { isDesktop } from "@/lib/api";
import { formatDateTime } from "@/lib/ui";
import type { ImportKind } from "@/lib/views";
import { SectionTitle } from "./shared";

export function LibraryView({
  openImport,
  openTraining,
  importJobs,
  openReview,
}: {
  openImport: (kind: Exclude<ImportKind, null>) => void;
  openTraining: (id: string) => void;
  importJobs: MyEuclidImportJob[];
  openReview: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("全部模块");
  const filtered = demoTasks.filter(
    task =>
      `${task.source}${task.title}${task.tags.join("")}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (filter === "全部模块" || task.tags.includes(filter))
  );
  const importActions = (
    <div className="inline-actions">
      <button className="text-action" onClick={() => openImport("source")}>
        <Upload size={15} /> 导入资料
      </button>
      <button className="text-action" onClick={() => openImport("paper")}>
        <Camera size={15} /> 上传答卷
      </button>
    </div>
  );
  if (isDesktop)
    return (
      <div className="view-shell">
        <SectionTitle
          eyebrow="SOURCE INDEX"
          title="题库档案"
          action={importActions}
        />
        <PublishedQuestionLibrary
          openTraining={openTraining}
          openReview={openReview}
        />
        <ImportLedger importJobs={importJobs} openReview={openReview} />
        <div className="archive-footnote">
          <Archive size={17} />
          <p>
            正式题库仅显示已发布题目；每条记录均回链到原件、页码、OCR
            审核版本、切分草案和人工标签。
          </p>
        </div>
      </div>
    );
  return (
    <div className="view-shell">
      <SectionTitle
        eyebrow="SOURCE INDEX"
        title="题库档案"
        action={importActions}
      />
      <div className="library-toolbar">
        <label className="search-box">
          <Search size={16} />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="搜索题号、来源、知识点"
          />
        </label>
        <label className="filter-select">
          <Filter size={15} />
          <select
            value={filter}
            onChange={event => setFilter(event.target.value)}
          >
            <option>全部模块</option>
            <option>数列</option>
            <option>计数</option>
            <option>几何</option>
          </select>
        </label>
        <span className="result-count">{filtered.length} 个示例条目</span>
      </div>
      <div className="library-table">
        <div className="table-head">
          <span>来源 / 小问</span>
          <span>标签</span>
          <span>难度</span>
          <span>状态</span>
          <span />
        </div>
        {filtered.map(task => (
          <article className="library-row" key={task.id}>
            <div>
              <p className="record-id">{task.id}</p>
              <h4>
                {task.source} · {task.number}
              </h4>
              <small>{task.title}</small>
            </div>
            <div>
              {task.tags.map(tag => (
                <span className="tag" key={tag}>
                  {tag}
                </span>
              ))}
            </div>
            <span className="difficulty-dot">
              <i />
              {task.difficulty}
            </span>
            <span className="status-pill">{task.status}</span>
            <button
              className="row-action"
              onClick={() => openTraining(task.id)}
            >
              打开 <ChevronRight size={15} />
            </button>
          </article>
        ))}
      </div>
      <ImportLedger importJobs={importJobs} openReview={openReview} />
      <div className="archive-footnote">
        <Archive size={17} />
        <p>
          示例题目仅用于展示训练界面。真实导入的资料会与原始文件、页码、切分区域、OCR
          版本和标签审核记录建立回链。
        </p>
      </div>
    </div>
  );
}

function ImportLedger({
  importJobs,
  openReview,
}: {
  importJobs: MyEuclidImportJob[];
  openReview: () => void;
}) {
  if (!importJobs.length) return null;
  return (
    <section className="import-ledger">
      <SectionTitle
        eyebrow="LOCAL IMPORT LEDGER"
        title="已归档的真实资料"
        action={
          <button className="text-action" onClick={openReview}>
            <FileSearch size={15} /> 打开审核工作台
          </button>
        }
      />
      <div className="import-job-list">
        {importJobs.map(job => (
          <article key={job.id}>
            <div>
              <FileText size={17} />
              <span>
                <strong>{job.originalName}</strong>
                <small>
                  {job.kind === "paper_response" ? "纸质答卷" : "题目资料"} ·{" "}
                  {formatDateTime(job.createdAt)}
                </small>
              </span>
            </div>
            <span className="job-status">
              <CheckCircle2 size={14} />{" "}
              {job.status === "needs_review" ? "待 OCR / 切分审核" : job.status}
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}
