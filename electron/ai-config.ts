import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { App } from "electron";
import type { AiProviderConfigInput, AiProviderStatus } from "./types.js";

export interface SecureStringStorage {
  isEncryptionAvailable(): boolean;
  encryptString(value: string): Buffer;
  decryptString(value: Buffer): string;
}

interface StoredAiProviderConfig extends AiProviderConfigInput { updatedAt: string; }

export function getAiConfigStoragePath(app: App) { return path.join(app.getPath("userData"), "secure", "ai-provider-config.bin"); }

function toStatus(config: StoredAiProviderConfig | null, storageAvailable: boolean): AiProviderStatus {
  if (!storageAvailable) return { configured: false, secureStorageAvailable: false, requiresPerRequestApproval: true, message: "此版本仅在 macOS Keychain 可用时保存 AI 服务密钥。" };
  if (!config) return { configured: false, secureStorageAvailable: true, requiresPerRequestApproval: true, message: "尚未配置 AI 服务。每次真实判卷都需要你主动确认。" };
  return { configured: true, secureStorageAvailable: true, providerLabel: config.providerLabel, baseUrl: config.baseUrl, model: config.model, updatedAt: config.updatedAt, requiresPerRequestApproval: true, message: "服务信息已安全保存；尚未发送任何题目、答卷或评分请求。" };
}

function validateConfig(input: AiProviderConfigInput): AiProviderConfigInput {
  if (!input || typeof input !== "object") throw new Error("AI 服务配置无效。");
  const providerLabel = input.providerLabel?.trim();
  const baseUrl = input.baseUrl?.trim().replace(/\/$/, "");
  const model = input.model?.trim();
  const apiKey = input.apiKey?.trim();
  if (!providerLabel || providerLabel.length > 80 || !model || model.length > 160 || !apiKey || apiKey.length > 4_000) throw new Error("服务名称、模型或密钥格式无效。");
  let parsed: URL;
  try { parsed = new URL(baseUrl); } catch { throw new Error("服务地址必须是有效的 HTTPS URL。"); }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) throw new Error("服务地址必须是无账号信息的 HTTPS URL。");
  return { providerLabel, baseUrl: parsed.toString().replace(/\/$/, ""), model, apiKey };
}

function keychainAvailable(storage: SecureStringStorage, platform?: NodeJS.Platform) { return (platform ?? process.platform) === "darwin" && storage.isEncryptionAvailable(); }

async function readStoredConfig(app: App, storage: SecureStringStorage, platform?: NodeJS.Platform): Promise<StoredAiProviderConfig | null> {
  if (!keychainAvailable(storage, platform)) return null;
  try {
    const decrypted = storage.decryptString(await readFile(getAiConfigStoragePath(app)));
    const parsed = JSON.parse(decrypted) as StoredAiProviderConfig;
    if (!parsed.providerLabel || !parsed.baseUrl || !parsed.model || !parsed.apiKey || !parsed.updatedAt) throw new Error("invalid config");
    return parsed;
  } catch { return null; }
}

export async function getAiProviderStatus(app: App, storage: SecureStringStorage, platform?: NodeJS.Platform): Promise<AiProviderStatus> {
  const storageAvailable = keychainAvailable(storage, platform);
  return toStatus(await readStoredConfig(app, storage, platform), storageAvailable);
}

export async function saveAiProviderConfig(app: App, storage: SecureStringStorage, input: AiProviderConfigInput, platform?: NodeJS.Platform): Promise<AiProviderStatus> {
  if (!keychainAvailable(storage, platform)) throw new Error("仅 macOS Keychain 可用于保存 AI 服务密钥；当前配置未保存。");
  const validated = validateConfig(input);
  const stored: StoredAiProviderConfig = { ...validated, updatedAt: new Date().toISOString() };
  const output = getAiConfigStoragePath(app);
  await mkdir(path.dirname(output), { recursive: true, mode: 0o700 });
  const temporary = `${output}.tmp`;
  await writeFile(temporary, storage.encryptString(JSON.stringify(stored)), { mode: 0o600 });
  await rename(temporary, output);
  return toStatus(stored, true);
}

export async function removeAiProviderConfig(app: App, storage: SecureStringStorage, platform?: NodeJS.Platform): Promise<AiProviderStatus> {
  await rm(getAiConfigStoragePath(app), { force: true });
  return toStatus(null, keychainAvailable(storage, platform));
}
