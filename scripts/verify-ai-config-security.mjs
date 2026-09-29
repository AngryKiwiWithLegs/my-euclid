import os from "node:os";
import path from "node:path";
import {
  access,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import AdmZip from "adm-zip";
import { exportBackup } from "../dist/electron/backup.js";
import { closeDatabase, getDatabase } from "../dist/electron/database.js";
import {
  getAiConfigStoragePath,
  getAiProviderRegistry,
  removeAiProvider,
  saveAiProvider,
  setDefaultAiProvider,
} from "../dist/electron/ai-config.js";

const root = await mkdtemp(path.join(os.tmpdir(), "my-euclid-ai-config-"));
const app = {
  getPath: name =>
    name === "userData"
      ? path.join(root, "user-data")
      : path.join(root, "temp"),
};
const secretA = "sk-my-euclid-test-secret-a-must-not-leak";
const secretB = "sk-my-euclid-test-secret-b-must-not-leak";
const storage = {
  isEncryptionAvailable: () => true,
  encryptString: value =>
    Buffer.from(`encrypted:${Buffer.from(value).toString("base64url")}`),
  decryptString: value => {
    const raw = value.toString("utf8");
    if (!raw.startsWith("encrypted:"))
      throw new Error("encrypted config is invalid");
    return Buffer.from(raw.slice("encrypted:".length), "base64url").toString(
      "utf8"
    );
  },
};

try {
  await mkdir(app.getPath("userData"), { recursive: true });
  getDatabase(app);
  const nonMac = await getAiProviderRegistry(app, storage, "linux");
  if (nonMac.secureStorageAvailable || nonMac.providers.length)
    throw new Error(
      "Non-macOS environments must not expose a writable AI key store."
    );
  await saveAiProvider(
    app,
    storage,
    {
      providerLabel: "Blocked",
      baseUrl: "https://api.example.test/v1",
      model: "model",
      apiKey: secretA,
      enabled: true,
    },
    "linux"
  )
    .then(() => {
      throw new Error("Non-macOS provider configuration unexpectedly saved.");
    })
    .catch(error => {
      if (!String(error.message).includes("macOS Keychain")) throw error;
    });

  const initial = await getAiProviderRegistry(app, storage, "darwin");
  if (!initial.secureStorageAvailable || initial.providers.length)
    throw new Error(
      "AI provider registry should begin empty with secure storage available."
    );
  const legacyPath = getAiConfigStoragePath(app);
  await mkdir(path.dirname(legacyPath), { recursive: true });
  await writeFile(
    legacyPath,
    storage.encryptString(
      JSON.stringify({
        providerLabel: "Legacy provider",
        baseUrl: "https://legacy.example.test/v1",
        model: "legacy-model",
        apiKey: secretA,
        updatedAt: "2026-01-01T00:00:00.000Z",
      })
    )
  );
  const migrated = await getAiProviderRegistry(app, storage, "darwin");
  if (
    migrated.providers.length !== 1 ||
    !migrated.providers[0]?.isDefault ||
    migrated.providers[0]?.providerLabel !== "Legacy provider"
  )
    throw new Error(
      "Single-provider configuration was not migrated into the multi-provider registry."
    );
  await rm(legacyPath, { force: true });
  const afterA = await saveAiProvider(
    app,
    storage,
    {
      providerLabel: "Provider A",
      baseUrl: "https://a.example.test/v1",
      model: "model-a",
      apiKey: secretA,
      enabled: true,
    },
    "darwin"
  );
  const providerA = afterA.providers[0];
  if (!providerA?.isDefault || JSON.stringify(afterA).includes(secretA))
    throw new Error(
      "First provider was not selected as default or leaked a secret."
    );
  const afterB = await saveAiProvider(
    app,
    storage,
    {
      providerLabel: "Provider B",
      baseUrl: "https://b.example.test/v1",
      model: "model-b",
      apiKey: secretB,
      enabled: true,
    },
    "darwin"
  );
  const providerB = afterB.providers.find(
    provider => provider.providerLabel === "Provider B"
  );
  if (!providerB || afterB.providers.length !== 2 || providerB.isDefault)
    throw new Error(
      "Second provider was not preserved alongside the original default."
    );
  const defaultB = await setDefaultAiProvider(
    app,
    storage,
    providerB.id,
    "darwin"
  );
  if (
    !defaultB.providers.find(provider => provider.id === providerB.id)
      ?.isDefault
  )
    throw new Error("Explicit default provider switch failed.");
  const editedB = await saveAiProvider(
    app,
    storage,
    {
      id: providerB.id,
      providerLabel: "Provider B",
      baseUrl: "https://b.example.test/v1",
      model: "model-b-revised",
      enabled: true,
    },
    "darwin"
  );
  if (
    editedB.providers.find(provider => provider.id === providerB.id)?.model !==
    "model-b-revised"
  )
    throw new Error(
      "Provider edit did not update the model while retaining its key."
    );
  const disabledB = await saveAiProvider(
    app,
    storage,
    {
      id: providerB.id,
      providerLabel: "Provider B",
      baseUrl: "https://b.example.test/v1",
      model: "model-b-revised",
      enabled: false,
    },
    "darwin"
  );
  if (
    !disabledB.providers.find(provider => provider.id === providerA.id)
      ?.isDefault
  )
    throw new Error(
      "Default provider did not fall back when the selected provider was disabled."
    );
  await setDefaultAiProvider(app, storage, providerB.id, "darwin")
    .then(() => {
      throw new Error("Disabled provider was incorrectly allowed as default.");
    })
    .catch(error => {
      if (!String(error.message).includes("已启用")) throw error;
    });

  const encryptedFile = await readFile(getAiConfigStoragePath(app));
  if (
    encryptedFile.toString("utf8").includes(secretA) ||
    encryptedFile.toString("utf8").includes(secretB)
  )
    throw new Error("AI provider secret was written to disk in plaintext.");
  const backupPath = path.join(root, "backup.myeuclid-backup.zip");
  await exportBackup(app, backupPath);
  const backup = new AdmZip(backupPath);
  if (
    backup
      .getEntries()
      .some(
        entry =>
          entry.entryName.includes("secure/") ||
          entry.getData().toString("utf8").includes(secretA) ||
          entry.getData().toString("utf8").includes(secretB)
      )
  )
    throw new Error(
      "AI provider secret or secure directory was included in the backup package."
    );

  const removedA = await removeAiProvider(app, storage, providerA.id, "darwin");
  if (removedA.providers.length !== 1 || removedA.defaultProviderId)
    throw new Error(
      "Removing the only enabled provider did not clear the default state."
    );
  const reenabledB = await saveAiProvider(
    app,
    storage,
    {
      id: providerB.id,
      providerLabel: "Provider B",
      baseUrl: "https://b.example.test/v1",
      model: "model-b-revised",
      enabled: true,
    },
    "darwin"
  );
  if (!reenabledB.providers[0]?.isDefault)
    throw new Error(
      "Re-enabling the remaining provider did not restore a usable default."
    );
  const empty = await removeAiProvider(app, storage, providerB.id, "darwin");
  if (empty.providers.length || empty.defaultProviderId)
    throw new Error("Final provider removal did not clear the registry.");
  await access(getAiConfigStoragePath(app))
    .then(() => {
      throw new Error(
        "AI provider config file still exists after final removal."
      );
    })
    .catch(error => {
      if (error?.code !== "ENOENT") throw error;
    });
  console.log(
    "Multi-provider AI secure storage and backup exclusion smoke test passed"
  );
} finally {
  closeDatabase();
  await rm(root, { recursive: true, force: true });
}
process.exit(0);
