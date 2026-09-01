// Barcode + OCR extraction.
//
// Barcode decoding is the trustworthy channel — a decode either succeeds
// (with a format checksum / error-correction check behind it) or it
// doesn't, so it's the only thing allowed to auto-capture in the live
// camera loop. OCR has no such guarantee — Tesseract will confidently
// return *something* even for a blurry, textureless photo — so it only
// ever runs when the user explicitly taps Capture Manually, and instead
// of gluing every line it sees into one string, it returns each plausible
// chunk separately so a human picks the right one.

const barcodeHints = (() => {
  if (typeof ZXing === "undefined") return null;
  const hints = new Map();
  hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
  hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
    ZXing.BarcodeFormat.CODE_128,
    ZXing.BarcodeFormat.CODE_39,
    ZXing.BarcodeFormat.CODE_93,
    ZXing.BarcodeFormat.CODABAR,
    ZXing.BarcodeFormat.EAN_13,
    ZXing.BarcodeFormat.EAN_8,
    ZXing.BarcodeFormat.UPC_A,
    ZXing.BarcodeFormat.UPC_E,
    ZXing.BarcodeFormat.ITF,
    ZXing.BarcodeFormat.DATA_MATRIX,
    ZXing.BarcodeFormat.QR_CODE,
    ZXing.BarcodeFormat.PDF_417,
    ZXing.BarcodeFormat.AZTEC,
  ]);
  return hints;
})();

const barcodeReader =
  typeof ZXing !== "undefined"
    ? new ZXing.BrowserMultiFormatReader(barcodeHints)
    : null;

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

// Lossless PNG for barcode decoding — JPEG compression artifacts around
// high-contrast edges are exactly what breaks thin barcode bars.
function canvasToImage(canvas) {
  return loadImage(canvas.toDataURL("image/png"));
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
    return data.text;
  } catch {
    return null;
  }
}

// Splits a raw OCR read into distinct candidate values instead of
// smashing every line into one string. A label with "OptiPlex 5490 AIO
// Series" next to "CN-0Y29XV-PE200-23O-0235-A00" should offer both as
// separate, pickable cards — not one unreadable merge of both.
function extractOcrCandidates(rawText) {
  if (!rawText) return [];
  const tokens = rawText.match(/[A-Za-z0-9][A-Za-z0-9-]{3,}/g) || [];
  const withDigit = tokens.filter((t) => /\d/.test(t));
  const pool = withDigit.length ? withDigit : tokens;
  return [...new Set(pool)].slice(0, 6);
}

// Extracts from a captured canvas: try barcode on the raw crop, then OCR
// on a preprocessed copy. Returns { candidates, method }.
async function extractFromImage(sourceCanvas) {
  const img = await canvasToImage(sourceCanvas);
  const barcodeText = await scanBarcode(img);
  if (barcodeText) return { candidates: [barcodeText], method: "barcode" };

  const processed = preprocessForOcr(sourceCanvas);
  const rawText = await scanText(processed);
  const candidates = extractOcrCandidates(rawText);
  return { candidates, method: "ocr" };
}

function classifyDetection(text) {
  return /^\d{4}$/.test(text.trim()) ? "tag" : "serial";
}
