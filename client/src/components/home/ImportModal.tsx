/** 导入弹窗：桌面端走系统文件选择器；浏览器预览提供演示任务。 */
import { useState } from "react";
import {
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  FolderOpen,
  Play,
  Upload,
  X,
} from "lucide-react";
import { isDesktop, toUserMessage } from "@/lib/api";
import type { ImportKind, Notify } from "@/lib/views";
import { useDialogA11y } from "@/hooks/useDialogA11y";

export function ImportModal({
  kind,
  onClose,
  onCompleted,
  openTraining,
  desktopImport,
}: {
  kind: Exclude<ImportKind, null>;
  onClose: () => void;
  onCompleted: Notify;
  openTraining: () => void;
  desktopImport: (kind: MyEuclidImportKind) => Promise<number>;
}) {
  const [fileName, setFileName] = useState("");
  const [step, setStep] = useState(1);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const dialogRef = useDialogA11y(onClose);
  const isPaper = kind === "paper";
  const title =
    kind === "source"
      ? "导入题目资料"
      : isPaper
        ? "上传纸质答卷"
        : "新建在线作答";
  const complete = async () => {
    setImportError(null);
    if (!isDesktop) {
      setStep(2);
      window.setTimeout(
        () =>
          onCompleted(
            isPaper ? "纸质答卷演示任务已建立" : "资料演示任务已建立"
          ),
        350
      );
      return;
    }
    try {
      setIsImporting(true);
      const count = await desktopImport(
        isPaper ? "paper_response" : "source_document"
      );
      if (!count) return;
      setStep(2);
      onCompleted(
        isPaper
          ? `已归档 ${count} 份纸质答卷，等待题号审核`
          : `已归档 ${count} 份资料，等待 OCR 与切分审核`
      );
    } catch (error) {
      setImportError(toUserMessage(error, "导入失败，请检查资料后重试。"));
    } finally {
      setIsImporting(false);
    }
  };
  if (kind === "answer")
    return (
      <div
        className="modal-backdrop"
        role="dialog"
        aria-modal="true"
        ref={dialogRef}
      >
        <div className="modal-card answer-modal">
          <button className="modal-close" onClick={onClose} aria-label="关闭">
            <X size={19} />
          </button>
          <p className="eyebrow">ONLINE ANSWER</p>
          <h2>开始一份在线作答</h2>
          <p>
            请选择题目后进入统一作答页。键入、手写与纸质附件会按时间线保存到同一题目中。
          </p>
          <button
            className="primary-button wide-button"
            onClick={() => {
              onClose();
              openTraining();
            }}
          >
            <Play size={16} /> 打开示例题面
          </button>
        </div>
      </div>
    );
  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      ref={dialogRef}
    >
      <div className="modal-card">
        <button className="modal-close" onClick={onClose} aria-label="关闭">
          <X size={19} />
        </button>
        <p className="eyebrow">LOCAL IMPORT · STEP {step} / 2</p>
        <h2>{title}</h2>
        {step === 1 ? (
          <>
            <p className="modal-copy">
              原始文件会保留在本地。
              {isPaper
                ? "提交后将按页归档，审核后进入与在线作答一致的评分流程。"
                : "导入后会生成 OCR 文本，供你逐项审核与切分。"}
            </p>
            {isDesktop ? (
              <button
                className="native-file-button"
                onClick={() => void complete()}
                disabled={isImporting}
              >
                <FolderOpen size={23} />
                <span>
                  <strong>
                    {isImporting ? "正在归档本地文件…" : "从本机选择资料"}
                  </strong>
                  <small>通过 macOS 原生文件选择器导入，可多选</small>
                </span>
                <ChevronRight size={17} />
              </button>
            ) : (
              <label className="drop-zone">
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.heic,.txt,.md"
                  onChange={event =>
                    setFileName(event.target.files?.[0]?.name ?? "")
                  }
                />
                <Upload size={24} />
                <strong>{fileName || "选择文件"}</strong>
                <span>支持 PDF、图片、扫描件、文本</span>
              </label>
            )}
            {importError && (
              <p className="import-error">
                <CircleHelp size={14} /> {importError}
              </p>
            )}
            <div className="modal-actions">
              <button className="secondary-button" onClick={onClose}>
                取消
              </button>
            </div>
          </>
        ) : (
          <div className="import-progress">
            <CheckCircle2 size={32} />
            <h3>{isPaper ? "已建立答卷审核任务" : "已建立资料审核任务"}</h3>
            <p>
              {isPaper
                ? "下一步会按页识别题号、手写区域和作答归属。"
                : "下一步会显示页码、切分边界、OCR 文本与标签草案。"}
            </p>
            <div className="progress-steps">
              <span className="done">
                <Check size={13} /> 原件归档
              </span>
              <span>等待 OCR</span>
              <span>审核切分</span>
            </div>
            <button className="primary-button wide-button" onClick={onClose}>
              返回工作台
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
