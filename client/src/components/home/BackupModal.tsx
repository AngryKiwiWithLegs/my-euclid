/** 本地备份与恢复弹窗：导出可校验备份包；恢复前先预检并在覆盖前保留恢复点。 */
import { useState } from "react";
import { ChevronRight, Download, Upload, X } from "lucide-react";
import { api, runAction } from "@/lib/api";
import type { Notify } from "@/lib/views";
import { useDialogA11y } from "@/hooks/useDialogA11y";

export function BackupModal({
  onClose,
  notify,
}: {
  onClose: () => void;
  notify: Notify;
}) {
  const [selection, setSelection] = useState<MyEuclidBackupSelection | null>(
    null
  );
  const [busy, setBusy] = useState(false);
  const dialogRef = useDialogA11y(onClose);
  const exportBackup = () =>
    runAction({
      setBusy,
      notify,
      fallbackError: "备份导出失败",
      work: async () => {
        const result = await api().backup.export();
        if ("outputName" in result)
          notify(`已导出本地备份：${result.outputName}`);
      },
    });
  const selectRestore = () =>
    runAction({
      setBusy,
      notify,
      fallbackError: "备份预检失败",
      work: async () => {
        const result = await api().backup.selectForRestore();
        if (result.selection) setSelection(result.selection);
      },
    });
  const restore = () =>
    runAction({
      setBusy,
      notify,
      fallbackError: "备份恢复失败",
      work: async () => {
        if (!selection) return;
        await api().backup.restore(selection.token);
        notify("备份已恢复，工作台将重新加载本地档案");
        onClose();
        window.setTimeout(() => window.location.reload(), 800);
      },
    });
  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      ref={dialogRef}
    >
      <div className="modal-card backup-modal">
        <button className="modal-close" onClick={onClose} aria-label="关闭">
          <X size={19} />
        </button>
        <p className="eyebrow">LOCAL BACKUP · RESTORE</p>
        <h2>本地备份与恢复</h2>
        <p className="modal-copy">
          导出包包含
          SQLite、题源原件、答卷附件与校验清单。恢复会覆盖当前本地档案，并在替换前自动保留恢复点。
        </p>
        <div className="backup-actions">
          <button
            className="native-file-button"
            onClick={() => void exportBackup()}
            disabled={busy}
          >
            <Download size={22} />
            <span>
              <strong>导出当前档案</strong>
              <small>生成可迁移、可校验的备份包</small>
            </span>
            <ChevronRight size={17} />
          </button>
          <button
            className="native-file-button"
            onClick={() => void selectRestore()}
            disabled={busy}
          >
            <Upload size={22} />
            <span>
              <strong>选择备份包并预检</strong>
              <small>先校验文件与清单，不会立即覆盖</small>
            </span>
            <ChevronRight size={17} />
          </button>
        </div>
        {selection && (
          <div className="restore-preflight">
            <p className="eyebrow">RESTORE PREVIEW</p>
            <h3>{selection.fileName}</h3>
            <div>
              <span>{selection.documentCount} 份资料</span>
              <span>{selection.responseCount} 个答卷版本</span>
              <span>{selection.attachmentCount} 个附件</span>
            </div>
            <p>此操作将覆盖当前本地档案。请确认已导出需要保留的最新数据。</p>
            <button
              className="primary-button wide-button destructive-action"
              onClick={() => void restore()}
              disabled={busy}
            >
              确认覆盖并恢复
            </button>
          </div>
        )}
        <div className="modal-actions">
          <button className="secondary-button" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
