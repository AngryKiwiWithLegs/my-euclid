import { describe, expect, it } from "vitest";
import { validateConfig } from "../electron/ai-config.js";
import type { AiProviderConfigInput } from "../electron/types.js";

const config = (
  overrides: Partial<AiProviderConfigInput> = {}
): AiProviderConfigInput => ({
  providerLabel: "我的服务",
  baseUrl: "https://api.example.com/v1/",
  model: "test-model",
  apiKey: "sk-test",
  enabled: true,
  ...overrides,
});

describe("validateConfig", () => {
  it("规范化 HTTPS 地址并去除末尾斜杠", () => {
    const result = validateConfig(config(), true);
    expect(result.baseUrl).toBe("https://api.example.com/v1");
    expect(result.apiKey).toBe("sk-test");
    expect(result.enabled).toBe(true);
  });

  it("拒绝非 HTTPS 地址", () => {
    expect(() =>
      validateConfig(config({ baseUrl: "http://api.example.com" }), true)
    ).toThrow("HTTPS");
  });

  it("拒绝非法地址与携带账号信息的地址", () => {
    expect(() =>
      validateConfig(config({ baseUrl: "not-a-url" }), true)
    ).toThrow();
    expect(() =>
      validateConfig(
        config({ baseUrl: "https://user:pass@api.example.com" }),
        true
      )
    ).toThrow("账号信息");
  });

  it("新增服务必须提供密钥；编辑时留空可沿用旧密钥", () => {
    expect(() => validateConfig(config({ apiKey: "  " }), true)).toThrow();
    const kept = validateConfig(config({ apiKey: "" }), false);
    expect(kept.apiKey).toBe("");
  });

  it("拒绝空的名称或模型，并接受可省略的密钥", () => {
    expect(() =>
      validateConfig(config({ providerLabel: "  " }), true)
    ).toThrow();
    expect(() => validateConfig(config({ model: "" }), true)).toThrow();
    const noKey = validateConfig(config({ apiKey: undefined }), false);
    expect(noKey.apiKey).toBe("");
  });
});
