import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import sharp from "sharp";
import type { App } from "electron";
import { getArchiveDirectory } from "./archive.js";
import { getReviewPageSource, saveOcrRegionRun } from "./database.js";
import { recognizeImageBuffer } from "./ocr.js";
import type { NormalizedRect, OcrRegion, ReviewPagePreview } from "./types.js";

const maximumPreviewBytes = 8 * 1024 * 1024;

function sourceKindFor(fileName: string): ReviewPagePreview["sourceKind"] {
  const extension = path.extname(fileName).toLowerCase();
  if (extension === ".pdf") return "pdf";
  if ([".png", ".jpg", ".jpeg", ".heic"].includes(extension)) return "image";
  return "text";
}

async function renderPage(app: App, pageId: string) {
  const source = getReviewPageSource(app, pageId);
  if (!source) throw new Error("未找到需要预览的本地页面。");
  const sourceKind = sourceKindFor(source.storedName);
  if (sourceKind === "text")
    return { source, sourceKind, buffer: null, width: 0, height: 0 };
  const archiveDirectory = getArchiveDirectory(app);
  const storedName = path.basename(source.storedName);
  if (storedName !== source.storedName) throw new Error("归档文件标识无效。");
  const sourcePath = path.join(archiveDirectory, storedName);
  const input =
    sourceKind === "pdf"
      ? await renderPdfPage(sourcePath, source.pageNumber)
      : sourcePath;
  const result = await sharp(input, { limitInputPixels: 80_000_000 })
    .rotate()
    .flatten({ background: "#ffffff" })
    .resize({ width: 1800, withoutEnlargement: true })
    .png()
    .toBuffer({ resolveWithObject: true });
  if (
    !result.info.width ||
    !result.info.height ||
    result.data.byteLength > maximumPreviewBytes
  )
    throw new Error("页面预览超过本地安全限制，请使用更小的原始扫描件。");
  return {
    source,
    sourceKind,
    buffer: result.data,
    width: result.info.width,
    height: result.info.height,
  };
}

async function renderPdfPage(
  sourcePath: string,
  pageNumber: number
): Promise<Buffer> {
  const pdf = await getDocument({
    data: new Uint8Array(await readFile(sourcePath)),
  }).promise;
  try {
    if (pageNumber < 1 || pageNumber > pdf.numPages)
      throw new Error("PDF 页码超出原始文件范围。");
    const page = await pdf.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(2, Math.max(1, 1600 / baseViewport.width));
    const viewport = page.getViewport({ scale });
    const canvas = createCanvas(
      Math.ceil(viewport.width),
      Math.ceil(viewport.height)
    );
    const context = canvas.getContext("2d");
    await page.render({
      canvas: canvas as unknown as HTMLCanvasElement,
      canvasContext: context as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;
    return canvas.toBuffer("image/png");
  } finally {
    await pdf.cleanup();
  }
}

export async function getReviewPagePreview(
  app: App,
  pageId: string
): Promise<ReviewPagePreview> {
  const rendered = await renderPage(app, pageId);
  if (!rendered.buffer)
    return {
      pageId,
      pageNumber: rendered.source.pageNumber,
      sourceKind: "text",
      available: false,
      reason: "文本资料没有可渲染的原始页面。",
    };
  return {
    pageId,
    pageNumber: rendered.source.pageNumber,
    sourceKind: rendered.sourceKind,
    available: true,
    dataUrl: `data:image/png;base64,${rendered.buffer.toString("base64")}`,
    width: rendered.width,
    height: rendered.height,
  };
}

export async function recognizeReviewRegion(
  app: App,
  pageId: string,
  rect: NormalizedRect
): Promise<OcrRegion> {
  const rendered = await renderPage(app, pageId);
  if (!rendered.buffer) throw new Error("当前资料没有可识别的图像页面。");
  const left = Math.floor(rect.x * rendered.width);
  const top = Math.floor(rect.y * rendered.height);
  const width = Math.max(
    12,
    Math.min(rendered.width - left, Math.ceil(rect.width * rendered.width))
  );
  const height = Math.max(
    12,
    Math.min(rendered.height - top, Math.ceil(rect.height * rendered.height))
  );
  const crop = await sharp(rendered.buffer)
    .extract({ left, top, width, height })
    .resize({ width: 1600, withoutEnlargement: true })
    .png()
    .toBuffer();
  if (!crop.byteLength || crop.byteLength > maximumPreviewBytes)
    throw new Error("所选区域超过本地识别限制，请缩小框选范围。");
  let ocrText = "";
  let ocrStatus: OcrRegion["ocrStatus"] = "extracted";
  try {
    ocrText = await recognizeImageBuffer(crop);
  } catch {
    ocrStatus = "failed";
  }
  return saveOcrRegionRun(app, {
    pageId,
    rect,
    sourceWidth: rendered.width,
    sourceHeight: rendered.height,
    cropSha256: createHash("sha256").update(crop).digest("hex"),
    cropPreviewDataUrl: `data:image/png;base64,${crop.toString("base64")}`,
    ocrText,
    ocrStatus,
  });
}
