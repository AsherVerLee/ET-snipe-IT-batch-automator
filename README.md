# ET Asset Batch Tool

A static, browser-only web app for East Troy Community School District IT staff to capture asset tag + serial number photos in the field and export a CSV batch for Snipe-IT.

**Everything runs client-side.** No server, no database, no API keys. Nothing is uploaded anywhere — photos are processed in the browser and discarded; only the extracted text values are kept (in the browser's `localStorage`) until you export or clear the batch.

## How it works

1. Choose **Live Camera** (phones/tablets in the field) or **Upload Photos** (bulk upload from a camera roll on desktop).
2. In Live Camera mode, align a barcode inside the on-screen guide box. The app continuously scans that cropped region (`ZXing`, checked every ~350ms with `TRY_HARDER` and a broad set of formats — Code128, Code39, EAN/UPC, DataMatrix, QR, PDF417, Aztec) and **auto-captures** as soon as it gets a decode, confirmed with a gold flash + short vibration. Barcode decoding is the only thing allowed to auto-fire, since a decode either succeeds (checksum-verified) or it doesn't — there's no such thing as a confidently wrong barcode read.
3. For labels with no barcode, tap **Capture Manually**. This runs OCR (`Tesseract.js`) against the guide-box crop after grayscaling, contrast-stretching, and upscaling it 3x. OCR is manual-only on purpose: unlike a barcode, Tesseract will confidently invent text from a blurry or textureless photo, so it never fires unattended. Rather than gluing every line it reads into one unreadable string, it returns each distinct alphanumeric chunk as its own "Pending Detection" card — pick the right one, discard the rest.
4. A detected 4-digit number is assumed to be the **Asset Tag**; anything else is assumed to be the **Serial**. If a slot is already filled, the result shows up as a "Pending Detection" card so you can assign it manually. A **Clear All** button on that section wipes stray/junk cards in one tap.
5. Fill in **Model** and **Status** (and optional checkout info), then **Add to Batch**.
6. Repeat for each asset. The batch table lets you edit or delete rows before exporting.
7. **Export CSV** downloads a file formatted for Snipe-IT's asset import.


## Editing the model list

Edit `js/models.js` — it's a plain array of `{ name, modelNumber, category }` objects seeded from the current Snipe-IT model export (2026-08-27). Add, remove, or rename entries any time; no build step needed.

## Editing the CSV columns

`js/csv.js` has a single `CSV_COLUMNS` array mapping each output column to a batch row field. Reorder, rename, or add columns there to match Snipe-IT's asset import template exactly once confirmed.

## Not yet implemented

- Direct Snipe-IT API sync (would require a small backend to hold API credentials safely — the CSV import path is the interim solution).
- Model list is manually maintained; not pulled live from Snipe-IT.
