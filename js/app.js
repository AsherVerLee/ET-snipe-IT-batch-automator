const COMPANY_NAME = "East Troy Community School District";
const BATCH_STORAGE_KEY = "etAssetBatch";

const state = {
  detections: [], // { id, text, type, thumbUrl }
  batch: [], // committed rows, persisted to localStorage
};

const el = {
  modeCameraBtn: document.getElementById("mode-camera-btn"),
  modeUploadBtn: document.getElementById("mode-upload-btn"),
  cameraPanel: document.getElementById("camera-panel"),
  uploadPanel: document.getElementById("upload-panel"),
  video: document.getElementById("camera-video"),
  startCameraBtn: document.getElementById("start-camera-btn"),
  stopCameraBtn: document.getElementById("stop-camera-btn"),
  snapBtn: document.getElementById("snap-btn"),
  fileInput: document.getElementById("file-input"),
  status: document.getElementById("processing-status"),
  detectionsList: document.getElementById("detections-list"),
  draftForm: document.getElementById("draft-form"),
  draftTag: document.getElementById("draft-tag"),
  draftSerial: document.getElementById("draft-serial"),
  draftModel: document.getElementById("draft-model"),
  draftStatus: document.getElementById("draft-status"),
  draftCheckoutType: document.getElementById("draft-checkout-type"),
  draftCheckoutTo: document.getElementById("draft-checkout-to"),
  clearDraftBtn: document.getElementById("clear-draft-btn"),
  batchCount: document.getElementById("batch-count"),
  batchTableBody: document.querySelector("#batch-table tbody"),
  exportCsvBtn: document.getElementById("export-csv-btn"),
  clearBatchBtn: document.getElementById("clear-batch-btn"),
};

let cameraStream = null;

function setStatus(message) {
  el.status.textContent = message;
}

function escapeHtml(str) {
  return String(str ?? "").replace(
    /[&<>"']/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        ch
      ])
  );
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

// --- Mode toggle -----------------------------------------------------------

function setMode(mode) {
  const isCamera = mode === "camera";
  el.cameraPanel.hidden = !isCamera;
  el.uploadPanel.hidden = isCamera;
  el.modeCameraBtn.classList.toggle("active", isCamera);
  el.modeUploadBtn.classList.toggle("active", !isCamera);
  if (!isCamera) stopCamera();
}

el.modeCameraBtn.addEventListener("click", () => setMode("camera"));
el.modeUploadBtn.addEventListener("click", () => setMode("upload"));

// --- Camera ------------------------------------------------------------

async function startCamera() {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
    });
    el.video.srcObject = cameraStream;
    el.startCameraBtn.hidden = true;
    el.stopCameraBtn.hidden = false;
    el.snapBtn.hidden = false;
  } catch (err) {
    setStatus("Camera access failed: " + err.message);
  }
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }
  el.video.srcObject = null;
  el.startCameraBtn.hidden = false;
  el.stopCameraBtn.hidden = true;
  el.snapBtn.hidden = true;
}

async function captureFromCamera() {
  const canvas = document.createElement("canvas");
  canvas.width = el.video.videoWidth;
  canvas.height = el.video.videoHeight;
  canvas.getContext("2d").drawImage(el.video, 0, 0);
  await processImageSource(canvas.toDataURL("image/jpeg", 0.85));
}

el.startCameraBtn.addEventListener("click", startCamera);
el.stopCameraBtn.addEventListener("click", stopCamera);
el.snapBtn.addEventListener("click", captureFromCamera);

// --- Upload --------------------------------------------------------------

el.fileInput.addEventListener("change", async () => {
  const files = Array.from(el.fileInput.files);
  el.fileInput.value = "";
  for (const file of files) {
    const dataUrl = await readFileAsDataUrl(file);
    await processImageSource(dataUrl);
  }
});

// --- Extraction pipeline ---------------------------------------------------

async function processImageSource(dataUrl) {
  setStatus("Processing photo…");
  const img = await loadImage(dataUrl);
  const { text, method } = await extractFromImage(img);
  if (!text) {
    setStatus("No barcode or text detected — enter the value manually below.");
    addDetection({ text: "", type: "unknown", thumbUrl: dataUrl, method });
    return;
  }
  const type = classifyDetection(text);
  setStatus(`Detected "${text}" via ${method}.`);
  addDetection({ text, type, thumbUrl: dataUrl, method });
}

function addDetection(detection) {
  detection.id = crypto.randomUUID();

  if (detection.type === "tag" && !el.draftTag.value) {
    el.draftTag.value = detection.text;
    renderDetections();
    return;
  }
  if (detection.type === "serial" && !el.draftSerial.value) {
    el.draftSerial.value = detection.text;
    renderDetections();
    return;
  }

  state.detections.push(detection);
  renderDetections();
}

function removeDetection(id) {
  state.detections = state.detections.filter((d) => d.id !== id);
  renderDetections();
}

function renderDetections() {
  el.detectionsList.innerHTML = "";
  if (state.detections.length === 0) {
    el.detectionsList.innerHTML =
      '<p class="empty-hint">No pending detections. Values that clearly match an empty field are filled in automatically.</p>';
    return;
  }
  for (const d of state.detections) {
    const card = document.createElement("div");
    card.className = "detection-card";
    const badgeText =
      d.type === "tag"
        ? "Looks like Asset Tag"
        : d.type === "serial"
        ? "Looks like Serial"
        : "Unclassified";
    card.innerHTML = `
      <img src="${d.thumbUrl}" alt="Captured photo" class="detection-thumb">
      <div class="detection-body">
        <input type="text" class="detection-text" value="${escapeHtml(
          d.text
        )}" placeholder="No text detected — type manually">
        <span class="detection-badge">${badgeText}</span>
        <div class="detection-actions">
          <button type="button" data-action="use-tag">Use as Asset Tag</button>
          <button type="button" data-action="use-serial">Use as Serial</button>
          <button type="button" data-action="discard">Discard</button>
        </div>
      </div>
    `;
    const textInput = card.querySelector(".detection-text");
    textInput.addEventListener("input", () => {
      d.text = textInput.value;
    });
    card.querySelector('[data-action="use-tag"]').addEventListener("click", () => {
      el.draftTag.value = d.text;
      removeDetection(d.id);
    });
    card.querySelector('[data-action="use-serial"]').addEventListener("click", () => {
      el.draftSerial.value = d.text;
      removeDetection(d.id);
    });
    card.querySelector('[data-action="discard"]').addEventListener("click", () => {
      removeDetection(d.id);
    });
    el.detectionsList.appendChild(card);
  }
}

// --- Model dropdown --------------------------------------------------------

function populateModelSelect() {
  const byCategory = {};
  for (const m of ASSET_MODELS) {
    (byCategory[m.category] ??= []).push(m);
  }
  const categories = Object.keys(byCategory).sort();

  el.draftModel.innerHTML = '<option value="">Select model…</option>';
  for (const cat of categories) {
    const group = document.createElement("optgroup");
    group.label = cat;
    for (const m of byCategory[cat].sort((a, b) => a.name.localeCompare(b.name))) {
      const opt = document.createElement("option");
      opt.value = `${m.name}|${m.modelNumber}`;
      opt.textContent =
        m.modelNumber && m.modelNumber !== m.name
          ? `${m.name} (${m.modelNumber})`
          : m.name;
      group.appendChild(opt);
    }
    el.draftModel.appendChild(group);
  }
}

// --- Draft row ---------------------------------------------------------

el.draftForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const assetTag = el.draftTag.value.trim();
  const serial = el.draftSerial.value.trim();
  const modelValue = el.draftModel.value;
  const status = el.draftStatus.value;

  if (!assetTag || !serial || !modelValue || !status) {
    setStatus("Asset Tag, Serial, Model, and Status are all required before adding to the batch.");
    return;
  }

  const [modelName, modelNumber] = modelValue.split("|");
  state.batch.push({
    id: crypto.randomUUID(),
    company: COMPANY_NAME,
    assetTag,
    serial,
    modelName,
    modelNumber,
    status,
    checkoutType: el.draftCheckoutType.value,
    checkoutTo: el.draftCheckoutTo.value.trim(),
  });
  saveBatch();
  renderBatch();
  clearDraft(false);
  setStatus("Added to batch.");
});

function clearDraft(resetStickyFields = true) {
  el.draftTag.value = "";
  el.draftSerial.value = "";
  el.draftCheckoutType.value = "";
  el.draftCheckoutTo.value = "";
  if (resetStickyFields) {
    el.draftModel.value = "";
    el.draftStatus.value = "";
  }
}

el.clearDraftBtn.addEventListener("click", () => clearDraft(true));

// --- Batch table -------------------------------------------------------

function renderBatch() {
  el.batchCount.textContent = state.batch.length;
  el.batchTableBody.innerHTML = "";
  for (const row of state.batch) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(row.company)}</td>
      <td><input value="${escapeHtml(row.assetTag)}" data-field="assetTag"></td>
      <td><input value="${escapeHtml(row.serial)}" data-field="serial"></td>
      <td>${escapeHtml(row.modelName)}</td>
      <td>${escapeHtml(row.status)}</td>
      <td>${escapeHtml(row.checkoutType)}</td>
      <td><input value="${escapeHtml(row.checkoutTo)}" data-field="checkoutTo"></td>
      <td><button type="button" data-action="delete">Delete</button></td>
    `;
    tr.querySelectorAll("input").forEach((input) => {
      input.addEventListener("change", () => {
        row[input.dataset.field] = input.value;
        saveBatch();
      });
    });
    tr.querySelector('[data-action="delete"]').addEventListener("click", () => {
      state.batch = state.batch.filter((r) => r.id !== row.id);
      saveBatch();
      renderBatch();
    });
    el.batchTableBody.appendChild(tr);
  }
}

function saveBatch() {
  localStorage.setItem(BATCH_STORAGE_KEY, JSON.stringify(state.batch));
}

function loadBatch() {
  try {
    const raw = localStorage.getItem(BATCH_STORAGE_KEY);
    if (raw) state.batch = JSON.parse(raw);
  } catch {
    state.batch = [];
  }
}

el.clearBatchBtn.addEventListener("click", () => {
  if (state.batch.length === 0) return;
  if (!confirm(`Clear all ${state.batch.length} batch rows? This cannot be undone.`)) return;
  state.batch = [];
  saveBatch();
  renderBatch();
});

el.exportCsvBtn.addEventListener("click", () => {
  if (state.batch.length === 0) {
    setStatus("Nothing to export — add at least one asset to the batch first.");
    return;
  }
  const stamp = new Date().toISOString().slice(0, 10);
  downloadCsv(state.batch, `asset-batch-${stamp}.csv`);
});

// --- Init ----------------------------------------------------------------

populateModelSelect();
loadBatch();
renderBatch();
renderDetections();
setMode("camera");
