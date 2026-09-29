/**
 * 一次性脚本：把 Google Fonts 字体下载到本地（OFL 许可），生成 src/fonts.css。
 * 用法：node scripts/fetch-fonts.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const FONT_DIR = path.resolve(
  import.meta.dirname,
  "../client/src/assets/fonts"
);
const CSS_OUTPUT = path.resolve(import.meta.dirname, "../client/src/fonts.css");
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const FAMILIES = [
  "family=DM+Serif+Display:ital,wght@0,400;1,400",
  "family=IBM+Plex+Sans:wght@400;600;700",
  "family=IBM+Plex+Mono",
  "family=Noto+Sans+SC:wght@400;600;700",
  "family=Noto+Serif+SC:wght@400;600;700",
];
const URL = `https://fonts.googleapis.com/css2?${FAMILIES.join("&")}&display=swap`;

const css = await (await fetch(URL, { headers: { "User-Agent": UA } })).text();
const urls = [
  ...new Set(
    [...css.matchAll(/https:\/\/fonts\.gstatic\.com\/[^)]+/g)].map(
      match => match[0]
    )
  ),
];
console.log(`发现 ${urls.length} 个字体文件`);
await mkdir(FONT_DIR, { recursive: true });

let downloaded = 0;
const tasks = urls.map(async url => {
  const fileName = url.split("/").pop();
  const buffer = Buffer.from(
    await (await fetch(url, { headers: { "User-Agent": UA } })).arrayBuffer()
  );
  await writeFile(path.join(FONT_DIR, fileName), buffer);
  downloaded += 1;
  if (downloaded % 50 === 0) console.log(`已下载 ${downloaded}/${urls.length}`);
  return [url, `./assets/fonts/${fileName}`];
});
const replacements = await Promise.all(tasks);

let localCss = `/* 本地字体：DM Serif Display、IBM Plex Sans、IBM Plex Mono、Noto Sans SC、Noto Serif SC。\n * 来源 Google Fonts，SIL Open Font License 1.1；由 scripts/fetch-fonts.mjs 生成。 */\n\n${css}`;
for (const [remote, local] of replacements)
  localCss = localCss.split(remote).join(local);
await writeFile(CSS_OUTPUT, localCss);
console.log(
  `完成：${replacements.length} 个字体文件 → client/src/assets/fonts/，样式表 → client/src/fonts.css`
);
