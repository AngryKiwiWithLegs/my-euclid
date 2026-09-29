/**
 * 模态框无障碍支持：挂载时聚焦首个可交互元素、Esc 触发关闭、卸载后归还焦点。
 * 用于自制 modal（ImportModal、BackupModal、LocalProfileModal、TutorPanel 等）。
 */
import { useEffect, useRef } from "react";

export function useDialogA11y(onClose: () => void) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const focusable = dialog?.querySelector<HTMLElement>(
      "input, textarea, select, button"
    );
    focusable?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    dialog?.addEventListener("keydown", onKeyDown);
    return () => {
      dialog?.removeEventListener("keydown", onKeyDown);
      restoreFocusRef.current?.focus?.();
    };
  }, [onClose]);

  return dialogRef;
}
