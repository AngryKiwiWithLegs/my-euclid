import { extractPages } from "../dist/electron/ocr.js";

const imagePath = process.argv.find(argument =>
  /\.(png|jpe?g|heic)$/i.test(argument)
);
if (!imagePath) throw new Error("Expected an image file path.");
const pages = await extractPages(imagePath);
if (
  !pages.length ||
  pages[0].ocrStatus !== "extracted" ||
  !pages[0].ocrText.toLowerCase().includes("euclid")
)
  throw new Error("Image OCR did not return the expected text.");
console.log("Image OCR smoke test passed");
process.exit(0);
