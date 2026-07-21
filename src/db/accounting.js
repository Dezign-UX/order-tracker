const sql = require('mssql');
const importedOrders = require('./importedOrders');

const isConfigured = Boolean(process.env.MSSQL_SERVER);

const DEMO_ORDERS = [
  { OrderNumber: 'SO-1001', CustomerName: 'Acme Builders Ltd', OrderDate: '2026-07-01', Total: 1240.5 },
  { OrderNumber: 'SO-1002', CustomerName: 'Harbourview Cafe', OrderDate: '2026-07-05', Total: 389.0 },
  { OrderNumber: 'SO-1003', CustomerName: 'J. Patterson', OrderDate: '2026-07-10', Total: 76.2 },
  { OrderNumber: 'SO-1004', CustomerName: 'Southern Cross Motors', OrderDate: '2026-07-15', Total: 5620.0 },
  { OrderNumber: 'SO-1005', CustomerName: 'Kowhai Reserve School', OrderDate: '2026-07-18', Total: 214.75 },
];

let pool;
async function getPool() {
  if (!pool) {
    pool = await sql.connect({
      server: process.env.MSSQL_SERVER,
      database: process.env.MSSQL_DATABASE,
      user: process.env.MSSQL_USER,
      password: process.env.MSSQL_PASSWORD,
      port: Number(process.env.MSSQL_PORT) || 1433,
      options: {
        encrypt: process.env.MSSQL_ENCRYPT === 'true',
        trustServerCertificate: true,
      },
    });
  }
  return pool;
}

function getSource() {
  if (isConfigured) return 'mssql';
  if (importedOrders.hasAnyOrders()) return 'import';
  return 'demo';
}

async function getOrders() {
  if (isConfigured) {
    const connectedPool = await getPool();
    const result = await connectedPool.request().query(process.env.ACCOUNTING_ORDERS_QUERY);
    return result.recordset;
  }
  if (importedOrders.hasAnyOrders()) {
    return importedOrders.getAllOrders().map((o) => ({
      OrderNumber: o.order_number,
      CustomerName: o.customer_name,
      OrderDate: o.order_date,
      Total: o.total,
    }));
  }
  return DEMO_ORDERS;
}

module.exports = { getOrders, isConfigured, getSource, getLastImportedAt: importedOrders.getLastImportedAt };
