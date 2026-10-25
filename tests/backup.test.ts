import { describe, expect, it } from "vitest";
import { validateEntryName } from "../electron/backup.js";

describe("validateEntryName", () => {
  it("接受备份包内的正常相对路径", () => {
    expect(validateEntryName("database/my-euclid.sqlite")).toBe(true);
    expect(validateEntryName("archive/originals/abc.pdf")).toBe(true);
    expect(validateEntryName("manifest.json")).toBe(true);
  });

  it("拒绝绝对路径与目录穿越", () => {
    expect(validateEntryName("/etc/passwd")).toBe(false);
    expect(validateEntryName("../secrets")).toBe(false);
    expect(validateEntryName("archive/../../../etc/passwd")).toBe(false);
    expect(validateEntryName("archive\\..\\..\\secrets")).toBe(false);
  });
});
