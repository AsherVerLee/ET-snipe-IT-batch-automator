// Barcode + OCR extraction. Barcode is tried first (fast, reliable for the
// 4-digit asset tag codes); OCR only runs when no barcode is found, and
// always against a contrast-enhanced, upscaled copy of the source — raw
// phone-camera photos are too low-contrast/small for Tesseract otherwise.

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

function canvasToImage(canvas) {
  return loadImage(canvas.toDataURL("image/jpeg", 0.92));
}

// Grayscale + contrast-stretch + upscale. Small, low-contrast label text
// (the actual problem, not a lack of training data) reads far more
// reliably through Tesseract after this than the raw camera frame does.
function preprocessForOcr(sourceCanvas, scale = 3) {
  const w = Math.max(1, Math.round(sourceCanvas.width * scale));
  const h = Math.max(1, Math.round(sourceCanvas.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(sourceCanvas, 0, 0, w, h);

  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const gray = new Uint8ClampedArray(w * h);
  let min = 255;
  let max = 0;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const g = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    gray[p] = g;
    if (g < min) min = g;
    if (g > max) max = g;
  }
  const range = Math.max(max - min, 1);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const stretched = ((gray[p] - min) / range) * 255;
    data[i] = data[i + 1] = data[i + 2] = stretched;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
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

async function scanText(source) {
  if (typeof Tesseract === "undefined") return null;
  try {
    const worker = await getOcrWorker();
    const { data } = await worker.recognize(source);
    return data.text.trim().replace(/\s+/g, "");
  } catch {
    return null;
  }
}

// Extracts from a captured canvas: try barcode on the raw crop, then OCR
// on a preprocessed copy. Returns { text, method }.
async function extractFromImage(sourceCanvas) {
  const img = await canvasToImage(sourceCanvas);
  const barcodeText = await scanBarcode(img);
  if (barcodeText) return { text: barcodeText, method: "barcode" };

  const processed = preprocessForOcr(sourceCanvas);
  const ocrText = await scanText(processed);
  if (ocrText) return { text: ocrText, method: "ocr" };

  return { text: "", method: "none" };
}

function classifyDetection(text) {
  return /^\d{4}$/.test(text.trim()) ? "tag" : "serial";
}

// Used by the live auto-capture loop to decide whether an in-progress OCR
// read is trustworthy enough to act on without the user pressing a button.
function looksValidOcr(text) {
  const cleaned = text.trim();
  if (cleaned.length < 4) return false;
  const alnum = cleaned.replace(/[^A-Za-z0-9]/g, "").length;
  return alnum / cleaned.length >= 0.8;
}
