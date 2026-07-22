const express = require('express');
const multer = require('multer');
const ExcelJS = require('exceljs');
const importedOrders = require('../db/importedOrders');
const tracker = require('../db/tracker');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Matches the ABM "Sales order" export: Reference, Customer Name, Order Date,
// Total inc.GST, Customer Order. Column order/position may shift between
// exports, so we look these up by header name rather than fixed position.
const COLUMN_ALIASES = {
  reference: ['reference'],
  customerName: ['customer name'],
  orderDate: ['order date'],
  total: ['total inc.gst', 'total inc gst', 'total'],
  customerOrder: ['customer order'],
};

function findHeaderRow(worksheet) {
  const maxScan = Math.min(5, worksheet.rowCount);
  for (let r = 1; r <= maxScan; r++) {
    let found = false;
    worksheet.getRow(r).eachCell({ includeEmpty: true }, (cell) => {
      if (String(cell.value || '').trim().toLowerCase() === 'reference') found = true;
    });
    if (found) return r;
  }
  return 1;
}

function findColumnIndexes(headerRow) {
  const headerCells = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headerCells[colNumber] = String(cell.value || '').trim().toLowerCase();
  });

  const indexes = {};
  for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
    indexes[key] = headerCells.findIndex((h) => aliases.includes(h));
  }
  return indexes;
}

function cellValue(row, colIndex) {
  if (!colIndex || colIndex < 1) return null;
  return row.getCell(colIndex).value;
}

function toText(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if (value.text) return String(value.text).trim();
    if (value.richText) return value.richText.map((t) => t.text).join('').trim();
    if (value.result !== undefined) return String(value.result).trim();
    return '';
  }
  return String(value).trim();
}

function toNumber(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'object' && value.result !== undefined) return Number(value.result) || 0;
  return Number(value) || 0;
}

function toDateIso(value) {
  if (value instanceof Date) return value.toISOString();
  return toText(value);
}

router.post('/import', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(req.file.buffer);
  } catch (err) {
    return res.status(400).json({ error: 'Could not read this file as an Excel spreadsheet.' });
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    return res.status(400).json({ error: 'This spreadsheet has no sheets.' });
  }

  const headerRowNumber = findHeaderRow(worksheet);
  const idx = findColumnIndexes(worksheet.getRow(headerRowNumber));

  if (idx.reference === -1) {
    return res.status(400).json({ error: "Could not find a 'Reference' column in this file." });
  }

  let imported = 0;
  let newOrders = 0;

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= headerRowNumber) return;

    const orderNumber = toText(cellValue(row, idx.reference));
    if (!orderNumber) return;

    const customerName = idx.customerName !== -1 ? toText(cellValue(row, idx.customerName)) : '';
    const orderDate = idx.orderDate !== -1 ? toDateIso(cellValue(row, idx.orderDate)) : '';
    const total = idx.total !== -1 ? toNumber(cellValue(row, idx.total)) : 0;
    const webOrderRef = idx.customerOrder !== -1 ? toText(cellValue(row, idx.customerOrder)) : '';

    importedOrders.upsertOrder({ orderNumber, customerName, orderDate, total });
    const isNew = tracker.seedFromImport(orderNumber, webOrderRef);
    imported += 1;
    if (isNew) newOrders += 1;
  });

  if (imported === 0) {
    return res.status(400).json({ error: 'No usable order rows found in this file.' });
  }

  res.json({ imported, newOrders });
});

module.exports = router;
