import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { archiveFiles } from "../dist/electron/archive.js";
import { closeDatabase, getReviewDocument } from "../dist/electron/database.js";
import {
  getReviewPagePreview,
  recognizeReviewRegion,
} from "../dist/electron/review-media.js";

const directory = mkdtempSync(path.join(tmpdir(), "my-euclid-region-ocr-"));
const app = { getPath: () => directory };
const imagePath = path.join(directory, "euclid-region.png");
const suppliedPdfPath = process.argv.find(value =>
  value.toLowerCase().endsWith(".pdf")
);

try {
  const svg = `<svg width="1600" height="1000" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="white"/><rect x="100" y="100" width="1400" height="360" fill="#fffdf6" stroke="#163A5F" stroke-width="5"/><text x="180" y="275" font-family="Arial" font-size="94" font-weight="700" fill="#111">EUCLID REGION 314</text><text x="180" y="390" font-family="Arial" font-size="50" fill="#111">Prove the invariant.</text><text x="180" y="760" font-family="Arial" font-size="42" fill="#777">Unrelated lower-page note</text></svg>`;
  await sharp(Buffer.from(svg)).png().toFile(imagePath);
  const sources = suppliedPdfPath ? [imagePath, suppliedPdfPath] : [imagePath];
  for (const sourcePath of sources) {
    const [job] = await archiveFiles(app, [sourcePath], "source_document");
    const detail = getReviewDocument(app, job.sourceDocumentId);
    if (!detail?.pages[0])
      throw new Error(
        `Review page was not created for ${path.basename(sourcePath)}.`
      );
    const page = detail.pages[0];
    const preview = await getReviewPagePreview(app, page.id);
    if (
      !preview.available ||
      !preview.dataUrl?.startsWith("data:image/png;base64,") ||
      !preview.width ||
      !preview.height
    )
      throw new Error(
        `Page preview was not generated for ${path.basename(sourcePath)}.`
      );
    const isPdf = sourcePath.toLowerCase().endsWith(".pdf");
    const region = await recognizeReviewRegion(
      app,
      page.id,
      isPdf
        ? { x: 0.02, y: 0.02, width: 0.96, height: 0.96 }
        : { x: 0.05, y: 0.06, width: 0.9, height: 0.45 }
    );
    if (region.ocrStatus !== "extracted")
      throw new Error(
        `Region OCR did not complete for ${path.basename(sourcePath)}.`
      );
    if (!isPdf && !region.ocrText.toLowerCase().includes("euclid"))
      throw new Error(
        "Image region OCR did not extract the selected source text."
      );
    const after = getReviewDocument(app, job.sourceDocumentId);
    if (
      after?.pages[0]?.regions.length !== 1 ||
      after.pages[0].regions[0].id !== region.id
    )
      throw new Error(
        `Region OCR audit record was not linked to ${path.basename(sourcePath)}.`
      );
  }
  console.log(
    "Image and scanned PDF page preview / region OCR smoke test passed"
  );
} finally {
  closeDatabase();
  rmSync(directory, { recursive: true, force: true });
}
process.exit(0);
