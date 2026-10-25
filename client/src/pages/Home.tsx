/**
 * 欧几里得档案室：应用首页。
 * Home 只负责视图路由与全局刷新；通知经由 lib/toast 全局 store。
 */
import { useEffect, useState } from "react";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { BackupModal } from "@/components/home/BackupModal";
import { Dashboard } from "@/components/home/Dashboard";
import { ImportModal } from "@/components/home/ImportModal";
import { LibraryView } from "@/components/home/LibraryView";
import { LocalProfileModal } from "@/components/home/LocalProfileModal";
import { ReviewWorkbench } from "@/components/home/ReviewWorkbench";
import { SideNav } from "@/components/home/SideNav";
import { TrainingHub } from "@/components/home/TrainingHub";
import {
  EvidenceWorkspace,
  ReportsWorkspace,
} from "@/components/AssessmentWorkspace";
import { AiProvidersWorkspace } from "@/components/AiProvidersWorkspace";
import { api, isDesktop, toUserMessage } from "@/lib/api";
import { DEMO_QUESTION_ID, STORAGE_KEYS, readLocalFlag } from "@/lib/constants";
import { useNotify } from "@/lib/toast";
import type { ImportKind, View } from "@/lib/views";

const viewByParam: Record<string, View> = {
  library: "library",
  review: "review",
  training: "training",
  evidence: "evidence",
  reports: "reports",
  ai: "ai",
};

export default function Home() {
  const [active, setActive] = useState<View>(
    () =>
      viewByParam[
        new URLSearchParams(window.location.search).get("view") ?? ""
      ] ?? "dashboard"
  );
  const [importKind, setImportKind] = useState<ImportKind>(null);
  const [trainingId, setTrainingId] = useState(DEMO_QUESTION_ID);
  const [backupOpen, setBackupOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [localUserName, setLocalUserName] = useState(() => {
    try {
      return (
        window.localStorage.getItem(STORAGE_KEYS.localUserName)?.trim() || "我"
      );
    } catch {
      return "我";
    }
  });
  const [importJobs, setImportJobs] = useState<MyEuclidImportJob[]>([]);
  const [reviewDocuments, setReviewDocuments] = useState<
    MyEuclidReviewDocumentSummary[]
  >([]);
  const [autoReviewBusy, setAutoReviewBusy] = useState(false);
  const [assessmentSessions, setAssessmentSessions] = useState<
    MyEuclidPracticeSession[]
  >([]);
  const [assessmentRecords, setAssessmentRecords] = useState<
    MyEuclidAssessmentRecord[]
  >([]);
  const [assessmentDashboard, setAssessmentDashboard] =
    useState<MyEuclidAssessmentDashboard | null>(null);

  const notify = useNotify();
  const refreshImportJobs = async () => {
    if (!isDesktop) return;
    try {
      setImportJobs(await api().archive.listImportJobs());
    } catch (error) {
      notify(toUserMessage(error, "读取导入记录失败"));
    }
  };
  const refreshReviewDocuments = async () => {
    if (!isDesktop) return;
    try {
      setReviewDocuments(await api().review.listDocuments());
    } catch (error) {
      notify(toUserMessage(error, "读取待审核资料失败"));
    }
  };
  const refreshAssessments = async () => {
    if (!isDesktop) return;
    try {
      const [sessions, records, dashboard] = await Promise.all([
        api().assessment.listSessions(),
        api().assessment.listRecords(),
        api().assessment.getDashboard(),
      ]);
      setAssessmentSessions(sessions);
      setAssessmentRecords(records);
      setAssessmentDashboard(dashboard);
    } catch (error) {
      notify(toUserMessage(error, "读取评分档案失败"));
    }
  };
  useEffect(() => {
    void refreshImportJobs();
    void refreshReviewDocuments();
    void refreshAssessments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runAutoReviewSilently = async () => {
    if (
      !isDesktop ||
      autoReviewBusy ||
      !readLocalFlag(STORAGE_KEYS.autoReview, false)
    )
      return;
    try {
      setAutoReviewBusy(true);
      notify(
        "AI 自动审核已启动：正在校对 OCR、切分并发布题目，无需其他操作…",
        15000
      );
      const summary = await api().ai.autoReviewAll();
      const detail = summary.documents
        .map(
          item =>
            `《${item.originalName}》发布 ${item.questionsPublished} 题${item.warnings?.length ? `（警告：${item.warnings.join("；")}）` : ""}`
        )
        .join("；");
      notify(
        `AI 自动审核完成：${detail || "无新增题目"}${summary.failures.length ? `；失败 → ${summary.failures.join("；")}` : ""}`,
        20000
      );
      await Promise.all([refreshImportJobs(), refreshReviewDocuments()]);
    } catch (error) {
      notify(toUserMessage(error, "AI 自动审核失败"));
    } finally {
      setAutoReviewBusy(false);
    }
  };
  const desktopImport = async (kind: MyEuclidImportKind) => {
    const result = await api().archive.selectAndImport(kind);
    if (!result.cancelled) {
      await refreshImportJobs();
      await refreshReviewDocuments();
      void runAutoReviewSilently();
    }
    return result.jobs.length;
  };
  const openTraining = (id: string = DEMO_QUESTION_ID) => {
    setTrainingId(id);
    setActive("training");
  };

  const renderView = () => {
    switch (active) {
      case "library":
        return (
          <LibraryView
            openImport={setImportKind}
            openTraining={openTraining}
            importJobs={importJobs}
            openReview={() => setActive("review")}
          />
        );
      case "review":
        return (
          <ReviewWorkbench
            documents={reviewDocuments}
            refreshDocuments={refreshReviewDocuments}
          />
        );
      case "training":
        return (
          <TrainingHub
            initialId={trainingId}
            backToLibrary={() => setActive("library")}
            onSubmit={() =>
              notify("作答已提交；后续可在错题证据和报告中继续复盘")
            }
          />
        );
      case "evidence":
        return (
          <EvidenceWorkspace
            sessions={assessmentSessions}
            records={assessmentRecords}
            refresh={refreshAssessments}
            openAiSettings={() => setActive("ai")}
          />
        );
      case "reports":
        return <ReportsWorkspace dashboard={assessmentDashboard} />;
      case "ai":
        return <AiProvidersWorkspace />;
      default:
        return (
          <Dashboard
            openImport={setImportKind}
            openTraining={openTraining}
            importedCount={importJobs.length}
          />
        );
    }
  };

  return (
    <div className="archive-app">
      <SideNav active={active} onChange={setActive} />
      <main className="workbench">
        <header className="topbar">
          <div className="crumb">
            <span>档案工作台</span>
            <i /> <span>{navLabel(active)}</span>
          </div>
          <div className="top-actions">
            <button
              className="quiet-button"
              onClick={() => setBackupOpen(true)}
            >
              本地备份 <ArrowUpRight size={15} />
            </button>
            <button
              className="profile-chip"
              onClick={() => setProfileOpen(true)}
              aria-label="编辑本地使用者"
            >
              <span>{localUserName.slice(0, 1)}</span>
              <ChevronDown size={14} />
            </button>
          </div>
        </header>
        {renderView()}
      </main>
      {importKind && (
        <ImportModal
          kind={importKind}
          onClose={() => setImportKind(null)}
          openTraining={() => openTraining()}
          desktopImport={desktopImport}
        />
      )}
      {backupOpen && <BackupModal onClose={() => setBackupOpen(false)} />}
      {profileOpen && (
        <LocalProfileModal
          currentName={localUserName}
          onClose={() => setProfileOpen(false)}
          onSaved={setLocalUserName}
        />
      )}
    </div>
  );
}

const viewLabels: Record<View, string> = {
  dashboard: "工作台",
  library: "题库档案",
  review: "审核工作台",
  training: "训练会话",
  evidence: "错题证据",
  reports: "报告与轨迹",
  ai: "AI 服务",
};
function navLabel(view: View): string {
  return viewLabels[view];
}
