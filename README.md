# ET Asset Batch Tool

A static, browser-only web app for East Troy Community School District IT staff to capture asset tag + serial number photos in the field and export a CSV batch for Snipe-IT.

**Everything runs client-side.** No server, no database, no API keys. Nothing is uploaded anywhere — photos are processed in the browser and discarded; only the extracted text values are kept (in the browser's `localStorage`) until you export or clear the batch.

## How it works

1. Choose **Live Camera** (phones/tablets in the field) or **Upload Photos** (bulk upload from a camera roll on desktop).
2. In Live Camera mode, align the barcode or label text inside the on-screen guide box. The app continuously scans that cropped region — a barcode is checked every ~350ms and OCR every ~1.2s — and **auto-captures** as soon as it gets a confident read (a gold flash + a short vibration confirm it). A "Capture Manually" button is always available as a fallback for tricky labels.
3. Every capture (live or uploaded) is scanned for a barcode first (`ZXing`), then falls back to OCR (`Tesseract.js`) if no barcode is found. Before OCR runs, the image is cropped to the guide box, grayscaled, contrast-stretched, and upscaled 3x — this is the fix for OCR reading garbage off a whole, low-contrast phone photo instead of just the label. It's not a training-data issue: Tesseract ships pretrained; framing and contrast are what make or break accuracy.
4. A detected 4-digit number is assumed to be the **Asset Tag**; anything else is assumed to be the **Serial**. If a slot is already filled, the result shows up as a "Pending Detection" card so you can assign it manually.
5. Fill in **Model** and **Status** (and optional checkout info), then **Add to Batch**.
6. Repeat for each asset. The batch table lets you edit or delete rows before exporting.
7. **Export CSV** downloads a file formatted for Snipe-IT's asset import.

## Deploying to GitHub Pages

1. Push this repo to GitHub.
2. In the repo settings, go to **Pages** → **Build and deployment** → **Deploy from a branch** → select the branch and `/ (root)`.
3. The site will be published at `https://<org>.github.io/<repo>/`.

No build step is required — it's plain HTML/CSS/JS.

## Editing the model list

Edit `js/models.js` — it's a plain array of `{ name, modelNumber, category }` objects seeded from the current Snipe-IT model export (2026-08-27). Add, remove, or rename entries any time; no build step needed.

## Editing the CSV columns

`js/csv.js` has a single `CSV_COLUMNS` array mapping each output column to a batch row field. Reorder, rename, or add columns there to match Snipe-IT's asset import template exactly once confirmed.

## Not yet implemented

- Direct Snipe-IT API sync (would require a small backend to hold API credentials safely — the CSV import path is the interim solution).
- Model list is manually maintained; not pulled live from Snipe-IT.
