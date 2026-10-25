import { defineConfig } from "vitest/config";

/** electron 源码内部使用 NodeNext 风格的 "./x.js" 导入；测试运行时映射到 ".ts"。 */
const resolveTsExtension = () => ({
  name: "resolve-ts-extension",
  enforce: "pre" as const,
  async resolveId(
    source: string,
    importer: string | undefined,
    options: { skipSelf?: boolean }
  ) {
    if (source.endsWith(".js") && importer?.endsWith(".ts")) {
      const resolved = await this.resolve(
        `${source.slice(0, -3)}.ts`,
        importer,
        { skipSelf: true, ...options }
      );
      if (resolved) return resolved;
    }
    return null;
  },
});

export default defineConfig({
  plugins: [resolveTsExtension()],
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
