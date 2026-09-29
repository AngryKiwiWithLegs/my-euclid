import { extractPages } from "../dist/electron/ocr.js";

const pdfPath = process.argv.find(argument =>
  argument.toLowerCase().endsWith(".pdf")
);
if (!pdfPath) throw new Error("Expected a PDF file path.");
const pages = await extractPages(pdfPath);
if (
  !pages.length ||
  !pages[0].ocrText.replace(/\s/g, "").includes("EuclidOCRverification")
)
  throw new Error("PDF text extraction did not return the expected page text.");
console.log("PDF page extraction smoke test passed");
process.exit(0);
