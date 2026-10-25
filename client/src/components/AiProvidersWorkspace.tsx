/**
 * 欧几里得档案室：AI 服务设置将配置组织为可审查的提供商卡片。
 * 用户自行维护提供商、模型和密钥；界面只接收脱敏状态，真实请求仍须逐次授权。
 */
import {
  CheckCircle2,
  CircleAlert,
  KeyRound,
  ListChecks,
  LockKeyhole,
  Pencil,
  Plus,
  Power,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Wifi,
} from "lucide-react";
import { useEffect, useState } from "react";
import { api, isDesktop } from "@/lib/api";
import { AiProvidersBrowserDemo } from "./AiProvidersBrowserDemo";
import "./AiProvidersWorkspace.css";
import { useNotify } from "@/lib/toast";

type ProviderDraft = {
  id?: string;
  providerLabel: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  enabled: boolean;
};
const emptyDraft = (): ProviderDraft => ({
  providerLabel: "",
  baseUrl: "",
  model: "",
  apiKey: "",
  enabled: true,
});

export function AiProvidersWorkspace() {
  const notify = useNotify();
  const [registry, setRegistry] = useState<MyEuclidAiProviderRegistry | null>(
    null
  );
  const [draft, setDraft] = useState<ProviderDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<
    Record<string, MyEuclidAiConnectionResult>
  >({});
  const refresh = async () => {
    setRegistry(await api().ai.getProviderRegistry());
  };
  useEffect(() => {
    void refresh();
  }, []);
  if (!isDesktop) return <AiProvidersBrowserDemo />;
  const mutate = async (
    work: () => Promise<MyEuclidAiProviderRegistry>,
    success: string
  ) => {
    try {
      setSaving(true);
      setRegistry(await work());
      notify(success);
    } catch (error) {
      notify(error instanceof Error ? error.message : "AI 服务设置未保存。");
    } finally {
      setSaving(false);
    }
  };
  const save = async () => {
    if (!draft) return;
    const apiKey = draft.apiKey.trim();
    await mutate(
      () =>
        api().ai.saveProvider({
          id: draft.id,
          providerLabel: draft.providerLabel,
          baseUrl: draft.baseUrl,
          model: draft.model,
          ...(apiKey ? { apiKey } : {}),
          enabled: draft.enabled,
        }),
      draft.id
        ? "AI 服务配置已更新；密钥保持在系统安全存储。"
        : "AI 服务已安全保存；尚未发送任何训练资料。"
    );
    setDraft(null);
  };
  const edit = (provider: MyEuclidAiProviderSummary) =>
    setDraft({
      id: provider.id,
      providerLabel: provider.providerLabel,
      baseUrl: provider.baseUrl,
      model: provider.model,
      apiKey: "",
      enabled: provider.enabled,
    });
  const testProvider = async (provider: MyEuclidAiProviderSummary) => {
    try {
      setTestingId(provider.id);
      const result = await api().ai.testProvider(provider.id);
      setTestResults(current => ({ ...current, [provider.id]: result }));
      notify(
        result.ok
          ? `${provider.providerLabel} 连接成功：${result.message}`
          : `${provider.providerLabel} 测试失败：${result.message}`
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : "服务连接测试失败。");
    } finally {
      setTestingId(null);
    }
  };
  return (
    <div className="view-shell ai-services-view">
      <div className="section-heading">
        <div>
          <p className="eyebrow">PERSONAL AI ROUTING</p>
          <h3>AI 服务</h3>
        </div>
        <span className="subtle-caption">提供商、模型与密钥均由你自行管理</span>
      </div>
      <section className="ai-services-intro">
        <div className="ai-intro-icon">
          <ShieldCheck size={22} />
        </div>
        <div>
          <h4>安全的多提供商工作台</h4>
          <p>
            添加任意 OpenAI 兼容 HTTPS
            服务，选择默认提供商，并为每次真实判卷单独确认。密钥从不显示、不会写入
            SQLite，也不会进入本地备份包。
          </p>
        </div>
        <span
          className={
            registry?.secureStorageAvailable
              ? "keychain-state ready"
              : "keychain-state unavailable"
          }
        >
          {registry?.secureStorageAvailable ? (
            <>
              <LockKeyhole size={14} /> macOS Keychain
            </>
          ) : (
            <>
              <CircleAlert size={14} /> Keychain 不可用
            </>
          )}
        </span>
      </section>
      {!registry?.secureStorageAvailable ? (
        <section className="ai-services-unavailable">
          <CircleAlert size={20} />
          <div>
            <strong>当前设备不能保存 AI 服务密钥</strong>
            <p>
              该功能仅在 macOS 上、系统 Keychain
              可用时启用。不会降级为明文配置。
            </p>
          </div>
        </section>
      ) : (
        <>
          <section className="ai-provider-toolbar">
            <div>
              <p className="eyebrow">PROVIDER REGISTRY</p>
              <h4>{registry?.providers.length ?? 0} 个已保存服务</h4>
            </div>
            <button
              className="primary-button"
              disabled={saving}
              onClick={() => setDraft(emptyDraft())}
            >
              <Plus size={15} /> 新增服务
            </button>
          </section>
          <div className="ai-provider-grid">
            {registry?.providers.map(provider => {
              const result = testResults[provider.id];
              return (
                <article
                  className={`ai-provider-card ${provider.isDefault ? "is-default" : ""} ${provider.enabled ? "" : "is-disabled"}`}
                  key={provider.id}
                >
                  <div className="provider-card-top">
                    <span className="provider-icon">
                      <Sparkles size={17} />
                    </span>
                    <div>
                      <h4>{provider.providerLabel}</h4>
                      <p>{provider.model}</p>
                    </div>
                    {provider.isDefault && (
                      <span className="default-badge">
                        <Star size={12} /> 默认
                      </span>
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
                      <dd>仅在 Keychain</dd>
                    </div>
                  </dl>
                  <div className="provider-card-actions">
                    <button
                      type="button"
                      className="text-action"
                      disabled={
                        !provider.enabled || saving || testingId === provider.id
                      }
                      onClick={() => void testProvider(provider)}
                    >
                      <Wifi size={14} />{" "}
                      {testingId === provider.id ? "测试中…" : "测试连接"}
                    </button>
                    <button
                      type="button"
                      className="text-action"
                      disabled={saving}
                      onClick={() =>
                        void mutate(
                          () =>
                            api().ai.saveProvider({
                              id: provider.id,
                              providerLabel: provider.providerLabel,
                              baseUrl: provider.baseUrl,
                              model: provider.model,
                              enabled: !provider.enabled,
                            }),
                          provider.enabled
                            ? "服务已停用；不会被设为默认。"
                            : "服务已启用。"
                        )
                      }
                    >
                      <Power size={14} /> {provider.enabled ? "停用" : "启用"}
                    </button>
                    <button
                      type="button"
                      className="text-action"
                      disabled={saving}
                      onClick={() => edit(provider)}
                    >
                      <Pencil size={14} /> 编辑
                    </button>
                    {!provider.isDefault && (
                      <button
                        type="button"
                        className="text-action"
                        disabled={!provider.enabled || saving}
                        onClick={() =>
                          void mutate(
                            () => api().ai.setDefaultProvider(provider.id),
                            "默认 AI 服务已切换。"
                          )
                        }
                      >
                        <Star size={14} /> 设为默认
                      </button>
                    )}
                    <button
                      type="button"
                      className="text-action destructive"
                      disabled={saving}
                      onClick={() => {
                        if (
                          window.confirm(
                            `移除“${provider.providerLabel}”及其系统安全存储中的密钥？`
                          )
                        )
                          void mutate(
                            () => api().ai.removeProvider(provider.id),
                            "AI 服务与其密钥已移除。"
                          );
                      }}
                    >
                      <Trash2 size={14} /> 删除
                    </button>
                  </div>
                  {result && (
                    <div
                      className={`provider-test-result ${result.ok ? "is-ok" : "is-error"}`}
                    >
                      <div>
                        <span>
                          {result.ok ? (
                            <CheckCircle2 size={14} />
                          ) : (
                            <CircleAlert size={14} />
                          )}
                        </span>
                        <strong>
                          {result.ok
                            ? `连接成功 · ${result.latencyMs} ms`
                            : "连接未通过"}
                        </strong>
                        <p>{result.message}</p>
                      </div>
                      {result.ok && result.models.length > 0 && (
                        <>
                          <small>
                            <ListChecks size={13} />{" "}
                            选择一个已发现的模型以打开编辑表单
                          </small>
                          <div className="model-chip-list">
                            {result.models.slice(0, 16).map(model => (
                              <button
                                key={model}
                                type="button"
                                onClick={() =>
                                  setDraft({
                                    id: provider.id,
                                    providerLabel: provider.providerLabel,
                                    baseUrl: provider.baseUrl,
                                    model,
                                    apiKey: "",
                                    enabled: provider.enabled,
                                  })
                                }
                              >
                                {model}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
            {!registry?.providers.length && (
              <div className="ai-provider-empty">
                <KeyRound size={24} />
                <h4>尚未添加 AI 服务</h4>
                <p>
                  新增一个 OpenAI 兼容服务后，可选择模型并将它设为默认判卷服务。
                </p>
                <button
                  className="secondary-button"
                  onClick={() => setDraft(emptyDraft())}
                >
                  <Plus size={14} /> 添加第一个服务
                </button>
              </div>
            )}
          </div>
          {draft && (
            <section className="ai-provider-editor">
              <div className="provider-editor-head">
                <div>
                  <p className="eyebrow">
                    {draft.id ? "EDIT PROVIDER" : "NEW PROVIDER"}
                  </p>
                  <h4>{draft.id ? "编辑 AI 服务" : "新增 AI 服务"}</h4>
                </div>
                <button
                  className="text-action"
                  onClick={() => setDraft(null)}
                  disabled={saving}
                >
                  取消
                </button>
              </div>
              <div className="provider-security-note">
                <LockKeyhole size={15} />
                <span>
                  密钥仅写入 macOS
                  Keychain。编辑时留空即可保留现有密钥；新增服务必须填写密钥。
                </span>
              </div>
              <div className="provider-form-grid">
                <label>
                  服务名称
                  <input
                    value={draft.providerLabel}
                    onChange={event =>
                      setDraft(
                        current =>
                          current && {
                            ...current,
                            providerLabel: event.target.value,
                          }
                      )
                    }
                    placeholder="例如：我的 OpenAI 兼容服务"
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
                    placeholder="由服务商提供的模型标识；可由连接测试返回结果选择"
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
                <label className="span-two">
                  {draft.id ? "更新 API 密钥（可留空）" : "API 密钥"}
                  <input
                    type="password"
                    value={draft.apiKey}
                    onChange={event =>
                      setDraft(
                        current =>
                          current && { ...current, apiKey: event.target.value }
                      )
                    }
                    placeholder={
                      draft.id
                        ? "留空以保留现有密钥"
                        : "仅本次输入用于写入 Keychain"
                    }
                    autoComplete="new-password"
                  />
                </label>
                <label className="enabled-check">
                  <input
                    type="checkbox"
                    checked={draft.enabled}
                    onChange={event =>
                      setDraft(
                        current =>
                          current && {
                            ...current,
                            enabled: event.target.checked,
                          }
                      )
                    }
                  />{" "}
                  <span>启用此服务供判卷时选择</span>
                </label>
              </div>
              <div className="provider-editor-actions">
                <button
                  className="secondary-button"
                  onClick={() => setDraft(null)}
                  disabled={saving}
                >
                  取消
                </button>
                <button
                  className="primary-button"
                  onClick={() => void save()}
                  disabled={saving}
                >
                  <CheckCircle2 size={15} />{" "}
                  {saving ? "正在安全保存…" : "安全保存服务"}
                </button>
              </div>
            </section>
          )}
          <section className="per-request-boundary">
            <LockKeyhole size={16} />
            <div>
              <strong>逐次授权仍然有效</strong>
              <p>
                {registry?.message}{" "}
                保存或设为默认都不会上传题目、答卷、笔迹或附件；真实 AI
                判卷会先展示本次发送内容，并要求你点击确认。
              </p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
