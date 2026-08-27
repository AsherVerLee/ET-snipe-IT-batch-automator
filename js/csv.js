// CSV column mapping. This is the one place to edit once the exact Snipe-IT
// import template is confirmed — add/reorder/rename entries here.
const CSV_COLUMNS = [
  { header: "Company", get: (row) => row.company },
  { header: "Asset Tag", get: (row) => row.assetTag },
  { header: "Serial", get: (row) => row.serial },
  { header: "Model", get: (row) => row.modelName },
  { header: "Model Number", get: (row) => row.modelNumber },
  { header: "Status", get: (row) => row.status },
  { header: "Checkout Type", get: (row) => row.checkoutType },
  { header: "Checkout To", get: (row) => row.checkoutTo },
];

function csvEscape(value) {
  const str = String(value ?? "");
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCsv(rows) {
  const lines = [CSV_COLUMNS.map((c) => csvEscape(c.header)).join(",")];
  for (const row of rows) {
    lines.push(CSV_COLUMNS.map((c) => csvEscape(c.get(row))).join(","));
  }
  return lines.join("\r\n");
}

function downloadCsv(rows, filename) {
  const csv = buildCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
