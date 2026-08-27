// Barcode + OCR extraction. Barcode is tried first (fast, reliable for the
// 4-digit asset tag codes); OCR only runs when no barcode is found.

const barcodeReader =
  typeof ZXing !== "undefined" ? new ZXing.BrowserMultiFormatReader() : null;

let ocrWorkerPromise = null;
function getOcrWorker() {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = Tesseract.createWorker("eng").then(async (worker) => {
      await worker.setParameters({
        tessedit_char_whitelist:
          "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-",
      });
      return worker;
    });
  }
  return ocrWorkerPromise;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = src;
  });
}

async function scanBarcode(imageElement) {
  if (!barcodeReader) return null;
  try {
    const result = await barcodeReader.decodeFromImage(imageElement);
    return result.getText().trim();
  } catch {
    return null;
  }
}

async function scanText(imageElement) {
  if (typeof Tesseract === "undefined") return null;
  try {
    const worker = await getOcrWorker();
    const { data } = await worker.recognize(imageElement);
    return data.text.trim().replace(/\s+/g, "");
  } catch {
    return null;
  }
}

async function extractFromImage(imageElement) {
  const barcodeText = await scanBarcode(imageElement);
  if (barcodeText) return { text: barcodeText, method: "barcode" };

  const ocrText = await scanText(imageElement);
  if (ocrText) return { text: ocrText, method: "ocr" };

  return { text: "", method: "none" };
}

function classifyDetection(text) {
  return /^\d{4}$/.test(text.trim()) ? "tag" : "serial";
}
