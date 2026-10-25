/** 通用确认弹窗：替代原生 window.confirm，与自制模态保持一致的纸张风格与无障碍行为。 */
import { AlertTriangle, X } from "lucide-react";
import { useDialogA11y } from "@/hooks/useDialogA11y";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "确认",
  destructive = false,
  busy = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const dialogRef = useDialogA11y(onClose);
  return (
    <div
      className="modal-backdrop"
      role="alertdialog"
      aria-modal="true"
      ref={dialogRef}
    >
      <div className="modal-card confirm-modal">
        <button className="modal-close" onClick={onClose} aria-label="关闭">
          <X size={19} />
        </button>
        <p className="eyebrow">CONFIRM ACTION</p>
        <h2>{title}</h2>
        <div className="confirm-message">
          {destructive && <AlertTriangle size={18} />}
          <p>{message}</p>
        </div>
        <div className="modal-actions">
          <button
            className="secondary-button"
            onClick={onClose}
            disabled={busy}
          >
            取消
          </button>
          <button
            className={
              destructive
                ? "primary-button destructive-action"
                : "primary-button"
            }
            disabled={busy}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
