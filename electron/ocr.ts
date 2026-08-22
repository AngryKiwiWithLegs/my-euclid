import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createWorker } from "tesseract.js";
import { readFile } from "node:fs/promises";
import path from "node:path";

export interface ExtractedPage { pageNumber: number; ocrText: string; ocrStatus: "pending" | "extracted" | "failed"; }

export async function extractPages(filePath: string): Promise<ExtractedPage[]> {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".txt" || extension === ".md") return [{ pageNumber: 1, ocrText: await readFile(filePath, "utf8"), ocrStatus: "extracted" }];
  if (extension === ".pdf") return extractPdfText(filePath);
  return extractImageText(filePath);
}

async function extractPdfText(filePath: string): Promise<ExtractedPage[]> {
  const data = new Uint8Array(await readFile(filePath));
  const pdf = await getDocument({ data }).promise;
  const pages: ExtractedPage[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items.map(item => "str" in item ? item.str : "").join(" ").replace(/\s+/g, " ").trim();
    pages.push({ pageNumber, ocrText: text, ocrStatus: text ? "extracted" : "pending" });
  }
  return pages;
}

async function extractImageText(filePath: string): Promise<ExtractedPage[]> {
  try {
    return [{ pageNumber: 1, ocrText: await recognizeImageBuffer(await readFile(filePath)), ocrStatus: "extracted" }];
  } catch {
    return [{ pageNumber: 1, ocrText: "", ocrStatus: "failed" }];
  }
}

export async function recognizeImageBuffer(image: Buffer): Promise<string> {
  let worker: Awaited<ReturnType<typeof createWorker>> | undefined;
  try {
    worker = await createWorker("eng");
    const result = await worker.recognize(image);
    return result.data.text.trim();
  } finally {
    await worker?.terminate();
  }
}
