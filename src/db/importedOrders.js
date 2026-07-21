const { db } = require('./sqlite');

db.exec(`
  CREATE TABLE IF NOT EXISTS imported_orders (
    order_number TEXT PRIMARY KEY,
    customer_name TEXT NOT NULL DEFAULT '',
    order_date TEXT NOT NULL DEFAULT '',
    total REAL NOT NULL DEFAULT 0,
    imported_at TEXT NOT NULL
  );
`);

const upsertStmt = db.prepare(`
  INSERT INTO imported_orders (order_number, customer_name, order_date, total, imported_at)
  VALUES (@order_number, @customer_name, @order_date, @total, @imported_at)
  ON CONFLICT(order_number) DO UPDATE SET
    customer_name = excluded.customer_name,
    order_date = excluded.order_date,
    total = excluded.total,
    imported_at = excluded.imported_at
`);

function upsertOrder({ orderNumber, customerName, orderDate, total }) {
  upsertStmt.run({
    order_number: orderNumber,
    customer_name: customerName || '',
    order_date: orderDate || '',
    total: total || 0,
    imported_at: new Date().toISOString(),
  });
}

function getAllOrders() {
  return db.prepare('SELECT * FROM imported_orders ORDER BY order_date DESC').all();
}

function hasAnyOrders() {
  return db.prepare('SELECT COUNT(*) AS c FROM imported_orders').get().c > 0;
}

function getLastImportedAt() {
  return db.prepare('SELECT MAX(imported_at) AS t FROM imported_orders').get().t;
}

module.exports = { upsertOrder, getAllOrders, hasAnyOrders, getLastImportedAt };
