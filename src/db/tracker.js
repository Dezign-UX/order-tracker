const { db } = require('./sqlite');

db.exec(`
  CREATE TABLE IF NOT EXISTS order_status (
    order_number TEXT PRIMARY KEY,
    web_order_ref TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Received',
    notes TEXT NOT NULL DEFAULT '',
    eta TEXT NOT NULL DEFAULT '',
    payment_received INTEGER NOT NULL DEFAULT 0,
    sales_order_created INTEGER NOT NULL DEFAULT 0,
    po_created INTEGER NOT NULL DEFAULT 0,
    po_number TEXT NOT NULL DEFAULT '',
    po_supplier_note TEXT NOT NULL DEFAULT '',
    cancel_po_deleted INTEGER NOT NULL DEFAULT 0,
    cancel_supplier_cancelled INTEGER NOT NULL DEFAULT 0,
    cancel_refund_issued INTEGER NOT NULL DEFAULT 0,
    cancel_so_cancelled INTEGER NOT NULL DEFAULT 0,
    updated_by TEXT NOT NULL DEFAULT '',
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS order_status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT NOT NULL,
    web_order_ref TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    eta TEXT NOT NULL DEFAULT '',
    payment_received INTEGER NOT NULL DEFAULT 0,
    sales_order_created INTEGER NOT NULL DEFAULT 0,
    po_created INTEGER NOT NULL DEFAULT 0,
    po_number TEXT NOT NULL DEFAULT '',
    po_supplier_note TEXT NOT NULL DEFAULT '',
    cancel_po_deleted INTEGER NOT NULL DEFAULT 0,
    cancel_supplier_cancelled INTEGER NOT NULL DEFAULT 0,
    cancel_refund_issued INTEGER NOT NULL DEFAULT 0,
    cancel_so_cancelled INTEGER NOT NULL DEFAULT 0,
    updated_by TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL
  );
`);

// Add any columns missing from an older copy of the database.
const FIELD_DEFS = {
  web_order_ref: `TEXT NOT NULL DEFAULT ''`,
  eta: `TEXT NOT NULL DEFAULT ''`,
  payment_received: `INTEGER NOT NULL DEFAULT 0`,
  sales_order_created: `INTEGER NOT NULL DEFAULT 0`,
  po_created: `INTEGER NOT NULL DEFAULT 0`,
  po_number: `TEXT NOT NULL DEFAULT ''`,
  po_supplier_note: `TEXT NOT NULL DEFAULT ''`,
  cancel_po_deleted: `INTEGER NOT NULL DEFAULT 0`,
  cancel_supplier_cancelled: `INTEGER NOT NULL DEFAULT 0`,
  cancel_refund_issued: `INTEGER NOT NULL DEFAULT 0`,
  cancel_so_cancelled: `INTEGER NOT NULL DEFAULT 0`,
};
for (const table of ['order_status', 'order_status_history']) {
  const existingColumns = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name));
  for (const [column, definition] of Object.entries(FIELD_DEFS)) {
    if (!existingColumns.has(column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }
}

const STATUSES = ['Received', 'Processing', 'Shipped', 'Delivered', 'On Hold', 'Cancelled'];

const BOOLEAN_FIELDS = [
  'payment_received',
  'sales_order_created',
  'po_created',
  'cancel_po_deleted',
  'cancel_supplier_cancelled',
  'cancel_refund_issued',
  'cancel_so_cancelled',
];

function computeLight(row) {
  if (row.status === 'Cancelled') {
    const fullyUnwound =
      row.cancel_po_deleted && row.cancel_supplier_cancelled && row.cancel_refund_issued && row.cancel_so_cancelled;
    return fullyUnwound ? 'red' : 'orange';
  }
  const flowing = row.payment_received && row.sales_order_created && row.po_created;
  return flowing ? 'green' : 'orange';
}

function getAllStatuses() {
  const rows = db.prepare('SELECT * FROM order_status').all();
  const byOrderNumber = {};
  for (const row of rows) {
    byOrderNumber[row.order_number] = row;
  }
  return byOrderNumber;
}

const upsertStmt = db.prepare(`
  INSERT INTO order_status (
    order_number, web_order_ref, status, notes, eta,
    payment_received, sales_order_created, po_created, po_number, po_supplier_note,
    cancel_po_deleted, cancel_supplier_cancelled, cancel_refund_issued, cancel_so_cancelled,
    updated_by, updated_at
  ) VALUES (
    @order_number, @web_order_ref, @status, @notes, @eta,
    @payment_received, @sales_order_created, @po_created, @po_number, @po_supplier_note,
    @cancel_po_deleted, @cancel_supplier_cancelled, @cancel_refund_issued, @cancel_so_cancelled,
    @updated_by, @updated_at
  )
  ON CONFLICT(order_number) DO UPDATE SET
    web_order_ref = excluded.web_order_ref,
    status = excluded.status,
    notes = excluded.notes,
    eta = excluded.eta,
    payment_received = excluded.payment_received,
    sales_order_created = excluded.sales_order_created,
    po_created = excluded.po_created,
    po_number = excluded.po_number,
    po_supplier_note = excluded.po_supplier_note,
    cancel_po_deleted = excluded.cancel_po_deleted,
    cancel_supplier_cancelled = excluded.cancel_supplier_cancelled,
    cancel_refund_issued = excluded.cancel_refund_issued,
    cancel_so_cancelled = excluded.cancel_so_cancelled,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at
`);

const historyStmt = db.prepare(`
  INSERT INTO order_status_history (
    order_number, web_order_ref, status, notes, eta,
    payment_received, sales_order_created, po_created, po_number, po_supplier_note,
    cancel_po_deleted, cancel_supplier_cancelled, cancel_refund_issued, cancel_so_cancelled,
    updated_by, updated_at
  ) VALUES (
    @order_number, @web_order_ref, @status, @notes, @eta,
    @payment_received, @sales_order_created, @po_created, @po_number, @po_supplier_note,
    @cancel_po_deleted, @cancel_supplier_cancelled, @cancel_refund_issued, @cancel_so_cancelled,
    @updated_by, @updated_at
  )
`);

function saveOrder(input) {
  const updatedAt = new Date().toISOString();
  const record = {
    order_number: input.orderNumber,
    web_order_ref: input.webOrderRef || '',
    status: input.status,
    notes: input.notes || '',
    eta: input.eta || '',
    payment_received: input.paymentReceived ? 1 : 0,
    sales_order_created: input.salesOrderCreated ? 1 : 0,
    po_created: input.poCreated ? 1 : 0,
    po_number: input.poNumber || '',
    po_supplier_note: input.poSupplierNote || '',
    cancel_po_deleted: input.cancelPoDeleted ? 1 : 0,
    cancel_supplier_cancelled: input.cancelSupplierCancelled ? 1 : 0,
    cancel_refund_issued: input.cancelRefundIssued ? 1 : 0,
    cancel_so_cancelled: input.cancelSoCancelled ? 1 : 0,
    updated_by: input.updatedBy || '',
    updated_at: updatedAt,
  };
  upsertStmt.run(record);
  historyStmt.run(record);
  return { ...record, light: computeLight(record) };
}

function getHistory(orderNumber) {
  return db
    .prepare('SELECT * FROM order_status_history WHERE order_number = ? ORDER BY id DESC')
    .all(orderNumber)
    .map((row) => ({ ...row, light: computeLight(row) }));
}

const seedStmt = db.prepare(`
  INSERT INTO order_status (order_number, web_order_ref, status, updated_by, updated_at)
  VALUES (@order_number, @web_order_ref, 'Received', 'System import', @updated_at)
  ON CONFLICT(order_number) DO NOTHING
`);

function seedFromImport(orderNumber, webOrderRef) {
  const info = seedStmt.run({
    order_number: orderNumber,
    web_order_ref: webOrderRef || '',
    updated_at: new Date().toISOString(),
  });
  return info.changes > 0;
}

module.exports = { STATUSES, BOOLEAN_FIELDS, computeLight, getAllStatuses, saveOrder, getHistory, seedFromImport };
