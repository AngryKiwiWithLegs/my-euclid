/**
 * 欧几里得档案室：浏览器预览只演示 AI 服务管理交互。
 * 所有状态仅留在当前页面内存；不收集密钥、不调用网络，也不代表真实桌面配置。
 */
import {
  CircleAlert,
  Edit3,
  KeyRound,
  LockKeyhole,
  Plus,
  Power,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  WifiOff,
} from "lucide-react";
import { useState } from "react";
import "./AiProvidersBrowserDemo.css";

type DemoProvider = {
  id: string;
  label: string;
  baseUrl: string;
  model: string;
  enabled: boolean;
  isDefault: boolean;
};
const emptyProvider = (): Omit<DemoProvider, "id" | "isDefault"> => ({
  label: "",
  baseUrl: "",
  model: "",
  enabled: true,
});

export function AiProvidersBrowserDemo({
  notify,
}: {
  notify: (message: string) => void;
}) {
  const [providers, setProviders] = useState<DemoProvider[]>([
    {
      id: "browser-demo",
      label: "浏览器演示服务",
      baseUrl: "https://api.example.com/v1",
      model: "example-judge-model",
      enabled: true,
      isDefault: true,
    },
  ]);
  const [draft, setDraft] = useState<
    (Omit<DemoProvider, "id" | "isDefault"> & { id?: string }) | null
  >(null);
  const save = () => {
    if (!draft?.label.trim() || !draft.baseUrl.trim() || !draft.model.trim()) {
      notify(
        "请完整填写服务名称、HTTPS 地址和模型标识。演示模式不会要求或保存密钥。"
      );
      return;
    }
    try {
      const parsed = new URL(draft.baseUrl);
      if (parsed.protocol !== "https:") throw new Error();
    } catch {
      notify("请填写有效的 HTTPS API 基地址。");
      return;
    }
    setProviders(current =>
      draft.id
        ? current.map(item =>
            item.id === draft.id
              ? {
                  ...item,
                  ...draft,
                  label: draft.label.trim(),
                  baseUrl: draft.baseUrl.trim().replace(/\/$/, ""),
                  model: draft.model.trim(),
                }
              : item
          )
        : [
            ...current,
            {
              id: `demo-${Date.now()}`,
              label: draft.label.trim(),
              baseUrl: draft.baseUrl.trim().replace(/\/$/, ""),
              model: draft.model.trim(),
              enabled: draft.enabled,
              isDefault: !current.some(item => item.isDefault && item.enabled),
            },
          ]
    );
    setDraft(null);
    notify("浏览器演示状态已更新；刷新页面后会重置，不会保存任何密钥。");
  };
  const setDefault = (id: string) => {
    setProviders(current =>
      current.map(item => ({ ...item, isDefault: item.id === id }))
    );
    notify("已切换演示默认服务；真实默认服务仅在桌面端保存。");
  };
  const toggle = (id: string) =>
    setProviders(current => {
      const target = current.find(item => item.id === id);
      const enabled = !target?.enabled;
      const fallback =
        !enabled && target?.isDefault
          ? current.find(item => item.id !== id && item.enabled)?.id
          : undefined;
      return current.map(item =>
        item.id === id
          ? { ...item, enabled, isDefault: enabled ? item.isDefault : false }
          : {
              ...item,
              isDefault: fallback ? item.id === fallback : item.isDefault,
            }
      );
    });
  const remove = (id: string) => {
    setProviders(current => {
      const next = current.filter(item => item.id !== id);
      const fallback = next.find(item => item.enabled)?.id;
      return next.map(item => ({
        ...item,
        isDefault:
          item.isDefault ||
          (item.id === fallback && !next.some(row => row.isDefault)),
      }));
    });
    notify("已移除演示服务；真实 Keychain 配置未受影响。");
  };
  return (
    <div className="view-shell ai-browser-demo">
      <div className="section-heading">
        <div>
          <p className="eyebrow">SAFE BROWSER SANDBOX</p>
          <h3>AI 服务</h3>
        </div>
        <span className="subtle-caption">可交互演示 · 不连接真实服务</span>
      </div>
      <section className="browser-demo-banner">
        <WifiOff size={21} />
        <div>
          <strong>浏览器演示模式</strong>
          <p>
            你可以新增、编辑、启停、设为默认或删除演示服务。所有状态只在当前页面内存中；真实
            API 密钥、模型发现、连接测试和 AI 判卷均被禁用。
          </p>
        </div>
        <span>
          <LockKeyhole size={13} /> 零密钥
        </span>
      </section>
      <section className="browser-demo-actions">
        <div>
          <p className="eyebrow">INTERACTION PREVIEW</p>
          <h4>{providers.length} 个演示服务</h4>
        </div>
        <button
          className="primary-button"
          onClick={() => setDraft(emptyProvider())}
        >
          <Plus size={15} /> 新增演示服务
        </button>
      </section>
      <div className="browser-provider-grid">
        {providers.map(provider => (
          <article
            className={`browser-provider-card ${provider.isDefault ? "is-default" : ""} ${provider.enabled ? "" : "is-disabled"}`}
            key={provider.id}
          >
            <div className="browser-provider-top">
              <span>
                <Sparkles size={17} />
              </span>
              <div>
                <h4>{provider.label}</h4>
                <p>{provider.model}</p>
              </div>
              {provider.isDefault && (
                <b>
                  <Star size={12} /> 默认
                </b>
              )}
            </div>
            <dl>
              <div>
                <dt>接口</dt>
                <dd>{provider.baseUrl}</dd>
              </div>
              <div>
                <dt>状态</dt>
                <dd>{provider.enabled ? "已启用" : "已停用"}</dd>
              </div>
              <div>
                <dt>密钥</dt>
                <dd>浏览器不保存</dd>
              </div>
            </dl>
            <div className="browser-provider-controls">
              <button
                className="text-action"
                onClick={() => {
                  toggle(provider.id);
                  notify(
                    provider.enabled ? "演示服务已停用。" : "演示服务已启用。"
                  );
                }}
              >
                <Power size={14} /> {provider.enabled ? "停用" : "启用"}
              </button>
              <button
                className="text-action"
                onClick={() =>
                  setDraft({
                    id: provider.id,
                    label: provider.label,
                    baseUrl: provider.baseUrl,
                    model: provider.model,
                    enabled: provider.enabled,
                  })
                }
              >
                <Edit3 size={14} /> 编辑
              </button>
              {!provider.isDefault && (
                <button
                  className="text-action"
                  disabled={!provider.enabled}
                  onClick={() => setDefault(provider.id)}
                >
                  <Star size={14} /> 设为默认
                </button>
              )}
              <button
                className="text-action destructive"
                onClick={() => remove(provider.id)}
              >
                <Trash2 size={14} /> 删除
              </button>
            </div>
            <div className="browser-provider-unavailable">
              <CircleAlert size={13} />
              <span>测试连接与模型发现仅在桌面端可用。</span>
            </div>
          </article>
        ))}
        {!providers.length && (
          <div className="browser-demo-empty">
            <KeyRound size={24} />
            <h4>没有演示服务</h4>
            <p>
              新增一个临时服务以体验管理交互。刷新页面后，这里的内容不会保留。
            </p>
            <button
              className="secondary-button"
              onClick={() => setDraft(emptyProvider())}
            >
              <Plus size={14} /> 添加服务
            </button>
          </div>
        )}
      </div>
      {draft && (
        <section className="browser-provider-editor">
          <div className="browser-editor-head">
            <div>
              <p className="eyebrow">
                {draft.id ? "EDIT DEMO PROVIDER" : "NEW DEMO PROVIDER"}
              </p>
              <h4>{draft.id ? "编辑演示服务" : "新增演示服务"}</h4>
            </div>
            <button className="text-action" onClick={() => setDraft(null)}>
              取消
            </button>
          </div>
          <div className="browser-editor-note">
            <ShieldCheck size={15} />
            <span>
              这是浏览器内存态演示。请不要输入真实 API
              密钥；该页面不会保存或发送密钥。
            </span>
          </div>
          <div className="browser-form-grid">
            <label>
              服务名称
              <input
                value={draft.label}
                onChange={event =>
                  setDraft(
                    current =>
                      current && { ...current, label: event.target.value }
                  )
                }
                placeholder="例如：我的演示判卷服务"
              />
            </label>
            <label>
              模型标识
              <input
                value={draft.model}
                onChange={event =>
                  setDraft(
                    current =>
                      current && { ...current, model: event.target.value }
                  )
                }
                placeholder="例如：judge-model"
              />
            </label>
            <label className="span-two">
              HTTPS API 基地址
              <input
                value={draft.baseUrl}
                onChange={event =>
                  setDraft(
                    current =>
                      current && { ...current, baseUrl: event.target.value }
                  )
                }
                placeholder="https://api.example.com/v1"
              />
            </label>
            <label className="browser-key-disabled span-two">
              API 密钥
              <input disabled value="浏览器演示模式不接收或保存密钥" />
            </label>
            <label className="browser-enabled">
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={event =>
                  setDraft(
                    current =>
                      current && { ...current, enabled: event.target.checked }
                  )
                }
              />{" "}
              <span>启用此演示服务</span>
            </label>
          </div>
          <div className="browser-editor-actions">
            <button className="secondary-button" onClick={() => setDraft(null)}>
              取消
            </button>
            <button className="primary-button" onClick={save}>
              <ShieldCheck size={15} /> 更新演示状态
            </button>
          </div>
        </section>
      )}
      <section className="browser-real-note">
        <LockKeyhole size={16} />
        <div>
          <strong>真实配置仍在桌面端</strong>
          <p>
            启动 <code>pnpm dev:desktop</code> 后，AI 服务页面才会访问 macOS
            Keychain、测试连接、发现模型，并在每次判卷前请求你的明确授权。
          </p>
        </div>
      </section>
    </div>
  );
}
