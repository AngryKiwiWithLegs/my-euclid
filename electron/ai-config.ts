import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { App } from "electron";
import type {
  AiProviderConfigInput,
  AiProviderRegistry,
  AiProviderSummary,
} from "./types.js";

export interface SecureStringStorage {
  isEncryptionAvailable(): boolean;
  encryptString(value: string): Buffer;
  decryptString(value: Buffer): string;
}

interface StoredAiProvider extends Required<Omit<AiProviderConfigInput, "id">> {
  id: string;
  createdAt: string;
  updatedAt: string;
}
interface StoredAiProviderVault {
  schemaVersion: 2;
  defaultProviderId?: string;
  providers: StoredAiProvider[];
}
interface LegacyAiProviderConfig {
  providerLabel: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  updatedAt: string;
}
const legacyProviderId = "legacy-default-provider";

export function getAiConfigStoragePath(app: App) {
  return path.join(app.getPath("userData"), "secure", "ai-provider-config.bin");
}
function keychainAvailable(
  storage: SecureStringStorage,
  platform?: NodeJS.Platform
) {
  return (
    (platform ?? process.platform) === "darwin" &&
    storage.isEncryptionAvailable()
  );
}
function emptyVault(): StoredAiProviderVault {
  return { schemaVersion: 2, providers: [] };
}

function validateConfig(
  input: AiProviderConfigInput,
  requiresKey: boolean
): Omit<AiProviderConfigInput, "id"> {
  if (!input || typeof input !== "object") throw new Error("AI 服务配置无效。");
  const providerLabel = input.providerLabel?.trim();
  const baseUrl = input.baseUrl?.trim().replace(/\/$/, "");
  const model = input.model?.trim();
  const apiKey = input.apiKey?.trim();
  if (
    !providerLabel ||
    providerLabel.length > 80 ||
    !model ||
    model.length > 160 ||
    (requiresKey && !apiKey) ||
    (apiKey && apiKey.length > 4_000)
  )
    throw new Error("服务名称、模型或密钥格式无效。");
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error("服务地址必须是有效的 HTTPS URL。");
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password)
    throw new Error("服务地址必须是无账号信息的 HTTPS URL。");
  return {
    providerLabel,
    baseUrl: parsed.toString().replace(/\/$/, ""),
    model,
    apiKey: apiKey ?? "",
    enabled: Boolean(input.enabled),
  };
}

function legacyToVault(value: unknown): StoredAiProviderVault | null {
  const config = value as Partial<LegacyAiProviderConfig>;
  if (
    !config?.providerLabel ||
    !config.baseUrl ||
    !config.model ||
    !config.apiKey ||
    !config.updatedAt
  )
    return null;
  return {
    schemaVersion: 2,
    defaultProviderId: legacyProviderId,
    providers: [
      {
        id: legacyProviderId,
        providerLabel: config.providerLabel,
        baseUrl: config.baseUrl,
        model: config.model,
        apiKey: config.apiKey,
        enabled: true,
        createdAt: config.updatedAt,
        updatedAt: config.updatedAt,
      },
    ],
  };
}

function parseVault(value: unknown): StoredAiProviderVault | null {
  const vault = value as Partial<StoredAiProviderVault>;
  if (
    vault?.schemaVersion === 2 &&
    Array.isArray(vault.providers) &&
    vault.providers.every(
      provider =>
        provider &&
        typeof provider.id === "string" &&
        typeof provider.providerLabel === "string" &&
        typeof provider.baseUrl === "string" &&
        typeof provider.model === "string" &&
        typeof provider.apiKey === "string" &&
        typeof provider.enabled === "boolean" &&
        typeof provider.createdAt === "string" &&
        typeof provider.updatedAt === "string"
    )
  )
    return {
      schemaVersion: 2,
      defaultProviderId: vault.defaultProviderId,
      providers: vault.providers as StoredAiProvider[],
    };
  return legacyToVault(value);
}

async function readVault(
  app: App,
  storage: SecureStringStorage,
  platform?: NodeJS.Platform
): Promise<StoredAiProviderVault> {
  if (!keychainAvailable(storage, platform)) return emptyVault();
  try {
    return (
      parseVault(
        JSON.parse(
          storage.decryptString(await readFile(getAiConfigStoragePath(app)))
        )
      ) ?? emptyVault()
    );
  } catch {
    return emptyVault();
  }
}

async function writeVault(
  app: App,
  storage: SecureStringStorage,
  vault: StoredAiProviderVault
) {
  const output = getAiConfigStoragePath(app);
  await mkdir(path.dirname(output), { recursive: true, mode: 0o700 });
  const temporary = `${output}.tmp`;
  await writeFile(temporary, storage.encryptString(JSON.stringify(vault)), {
    mode: 0o600,
  });
  await rename(temporary, output);
}

function selectDefault(vault: StoredAiProviderVault, proposed?: string) {
  const candidate = proposed
    ? vault.providers.find(
        provider => provider.id === proposed && provider.enabled
      )
    : undefined;
  if (candidate) return candidate.id;
  const current = vault.defaultProviderId
    ? vault.providers.find(
        provider => provider.id === vault.defaultProviderId && provider.enabled
      )
    : undefined;
  return current?.id ?? vault.providers.find(provider => provider.enabled)?.id;
}

function toRegistry(
  vault: StoredAiProviderVault,
  available: boolean
): AiProviderRegistry {
  if (!available)
    return {
      secureStorageAvailable: false,
      providers: [],
      requiresPerRequestApproval: true,
      message: "此版本仅在 macOS Keychain 可用时保存或读取 AI 服务配置。",
    };
  const defaultProviderId = selectDefault(vault);
  const providers: AiProviderSummary[] = vault.providers.map(provider => ({
    id: provider.id,
    providerLabel: provider.providerLabel,
    baseUrl: provider.baseUrl,
    model: provider.model,
    enabled: provider.enabled,
    isDefault: provider.id === defaultProviderId,
    createdAt: provider.createdAt,
    updatedAt: provider.updatedAt,
  }));
  return {
    secureStorageAvailable: true,
    providers,
    defaultProviderId,
    requiresPerRequestApproval: true,
    message: providers.length
      ? "服务配置已安全保存。配置不会自动发送题目、答卷或附件。"
      : "尚未配置 AI 服务。每次真实判卷都需要你主动确认。",
  };
}

export async function getAiProviderRegistry(
  app: App,
  storage: SecureStringStorage,
  platform?: NodeJS.Platform
): Promise<AiProviderRegistry> {
  const available = keychainAvailable(storage, platform);
  return toRegistry(await readVault(app, storage, platform), available);
}

export async function saveAiProvider(
  app: App,
  storage: SecureStringStorage,
  input: AiProviderConfigInput,
  platform?: NodeJS.Platform
): Promise<AiProviderRegistry> {
  if (!keychainAvailable(storage, platform))
    throw new Error(
      "仅 macOS Keychain 可用于保存 AI 服务密钥；当前配置未保存。"
    );
  const vault = await readVault(app, storage, platform);
  const existing = input.id
    ? vault.providers.find(provider => provider.id === input.id)
    : undefined;
  if (input.id && !existing) throw new Error("未找到要编辑的 AI 服务配置。");
  const validated = validateConfig(input, !existing);
  const now = new Date().toISOString();
  const provider: StoredAiProvider = {
    id: existing?.id ?? randomUUID(),
    ...validated,
    apiKey: validated.apiKey || existing!.apiKey,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  vault.providers = existing
    ? vault.providers.map(item => (item.id === provider.id ? provider : item))
    : [...vault.providers, provider];
  vault.defaultProviderId = selectDefault(
    vault,
    existing?.id === vault.defaultProviderId && !provider.enabled
      ? undefined
      : vault.defaultProviderId
  );
  if (!vault.defaultProviderId && provider.enabled)
    vault.defaultProviderId = provider.id;
  await writeVault(app, storage, vault);
  return toRegistry(vault, true);
}

export async function setDefaultAiProvider(
  app: App,
  storage: SecureStringStorage,
  providerId: string,
  platform?: NodeJS.Platform
): Promise<AiProviderRegistry> {
  if (!keychainAvailable(storage, platform))
    throw new Error("仅 macOS Keychain 可管理 AI 服务配置。");
  const vault = await readVault(app, storage, platform);
  if (
    !vault.providers.some(
      provider => provider.id === providerId && provider.enabled
    )
  )
    throw new Error("默认服务必须是已启用的提供商。");
  vault.defaultProviderId = providerId;
  await writeVault(app, storage, vault);
  return toRegistry(vault, true);
}

export async function removeAiProvider(
  app: App,
  storage: SecureStringStorage,
  providerId: string,
  platform?: NodeJS.Platform
): Promise<AiProviderRegistry> {
  if (!keychainAvailable(storage, platform))
    throw new Error("仅 macOS Keychain 可管理 AI 服务配置。");
  const vault = await readVault(app, storage, platform);
  if (!vault.providers.some(provider => provider.id === providerId))
    throw new Error("未找到要删除的 AI 服务配置。");
  vault.providers = vault.providers.filter(
    provider => provider.id !== providerId
  );
  vault.defaultProviderId = selectDefault(
    vault,
    vault.defaultProviderId === providerId ? undefined : vault.defaultProviderId
  );
  if (!vault.providers.length)
    await rm(getAiConfigStoragePath(app), { force: true });
  else await writeVault(app, storage, vault);
  return toRegistry(vault, true);
}

export async function getAiProviderForUse(
  app: App,
  storage: SecureStringStorage,
  providerId?: string,
  platform?: NodeJS.Platform
) {
  if (!keychainAvailable(storage, platform))
    throw new Error("macOS Keychain 当前不可用，不能读取 AI 服务密钥。");
  const vault = await readVault(app, storage, platform);
  const selectedId = providerId ?? selectDefault(vault);
  const provider = selectedId
    ? vault.providers.find(item => item.id === selectedId)
    : undefined;
  if (!provider || !provider.enabled)
    throw new Error("请先在 AI 服务中选择一个已启用的默认提供商。");
  return provider;
}
