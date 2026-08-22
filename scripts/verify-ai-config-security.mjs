import os from "node:os";
import path from "node:path";
import { access, mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import AdmZip from "adm-zip";
import { exportBackup } from "../dist/electron/backup.js";
import { closeDatabase, getDatabase } from "../dist/electron/database.js";
import { getAiConfigStoragePath, getAiProviderStatus, removeAiProviderConfig, saveAiProviderConfig } from "../dist/electron/ai-config.js";

const root = await mkdtemp(path.join(os.tmpdir(), "my-euclid-ai-config-"));
const app = { getPath: (name) => name === "userData" ? path.join(root, "user-data") : path.join(root, "temp") };
const secret = "sk-my-euclid-test-secret-must-not-leak";
const storage = {
  isEncryptionAvailable: () => true,
  encryptString: (value) => Buffer.from(`encrypted:${Buffer.from(value).toString("base64url")}`),
  decryptString: (value) => {
    const raw = value.toString("utf8");
    if (!raw.startsWith("encrypted:")) throw new Error("encrypted config is invalid");
    return Buffer.from(raw.slice("encrypted:".length), "base64url").toString("utf8");
  },
};

try {
  await mkdir(app.getPath("userData"), { recursive: true });
  getDatabase(app);
  const nonMacStatus = await getAiProviderStatus(app, storage, "linux");
  if (nonMacStatus.secureStorageAvailable || nonMacStatus.configured) throw new Error("Non-macOS environments must not expose a writable AI key store.");
  await saveAiProviderConfig(app, storage, { providerLabel: "Test provider", baseUrl: "https://api.example.test/v1", model: "test-model", apiKey: secret }, "linux").then(() => { throw new Error("Non-macOS provider configuration unexpectedly saved."); }).catch(error => { if (!String(error.message).includes("macOS Keychain")) throw error; });
  const initial = await getAiProviderStatus(app, storage, "darwin");
  if (initial.configured || !initial.secureStorageAvailable) throw new Error("AI provider should begin unconfigured with secure storage available.");
  const saved = await saveAiProviderConfig(app, storage, { providerLabel: "Test provider", baseUrl: "https://api.example.test/v1", model: "test-model", apiKey: secret }, "darwin");
  if (!saved.configured || saved.providerLabel !== "Test provider" || JSON.stringify(saved).includes(secret) || "apiKey" in saved) throw new Error("AI provider status leaked the secret or omitted the non-sensitive configuration.");
  const encryptedFile = await readFile(getAiConfigStoragePath(app));
  if (encryptedFile.toString("utf8").includes(secret)) throw new Error("AI provider secret was written to disk in plaintext.");
  const backupPath = path.join(root, "backup.myeuclid-backup.zip");
  await exportBackup(app, backupPath);
  const backup = new AdmZip(backupPath);
  if (backup.getEntries().some(entry => entry.entryName.includes("secure/") || entry.getData().toString("utf8").includes(secret))) throw new Error("AI provider secret or secure directory was included in the backup package.");
  const removed = await removeAiProviderConfig(app, storage, "darwin");
  if (removed.configured) throw new Error("AI provider configuration removal did not clear the status.");
  await access(getAiConfigStoragePath(app)).then(() => { throw new Error("AI provider config file still exists after removal."); }).catch(error => { if (error?.code !== "ENOENT") throw error; });
  console.log("AI secure storage and backup exclusion smoke test passed");
} finally {
  closeDatabase();
  await rm(root, { recursive: true, force: true });
}
process.exit(0);
