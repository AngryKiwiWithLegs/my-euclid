/** 本地使用者资料：仅保存界面显示名称，无需注册或登录。 */
import { useState } from "react";
import { Check, X } from "lucide-react";
import { STORAGE_KEYS } from "@/lib/constants";
import type { Notify } from "@/lib/views";
import { useDialogA11y } from "@/hooks/useDialogA11y";

export function LocalProfileModal({
  currentName,
  onClose,
  onSaved,
  notify,
}: {
  currentName: string;
  onClose: () => void;
  onSaved: (name: string) => void;
  notify: Notify;
}) {
  const [name, setName] = useState(currentName);
  const dialogRef = useDialogA11y(onClose);
  const save = () => {
    const next = name.trim().slice(0, 24) || "我";
    try {
      window.localStorage.setItem(STORAGE_KEYS.localUserName, next);
    } catch {
      /* 本地资料显示退化为会话内状态 */
    }
    onSaved(next);
    notify("本地使用者资料已保存；My Euclid 不需要注册或登录账号。");
    onClose();
  };
  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="local-profile-title"
      ref={dialogRef}
    >
      <div className="modal-card answer-modal">
        <button className="modal-close" onClick={onClose} aria-label="关闭">
          <X size={19} />
        </button>
        <p className="eyebrow">LOCAL PROFILE</p>
        <h2 id="local-profile-title">本地使用者</h2>
        <p>
          My Euclid
          是个人离线备考工具，无需注册用户或登录外部账号。此名称只保存在当前设备，用于界面显示。
        </p>
        <label className="ocr-editor">
          <span>
            <strong>显示名称</strong>
            <small>最多 24 个字符</small>
          </span>
          <input
            value={name}
            onChange={event => setName(event.target.value)}
            maxLength={24}
            autoFocus
          />
        </label>
        <div className="modal-actions">
          <button className="secondary-button" onClick={onClose}>
            取消
          </button>
          <button className="primary-button" onClick={save}>
            <Check size={15} /> 保存本地资料
          </button>
        </div>
      </div>
    </div>
  );
}
