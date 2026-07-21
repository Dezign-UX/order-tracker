const express = require('express');
const accounting = require('../db/accounting');
const tracker = require('../db/tracker');

const router = express.Router();

router.get('/statuses', (req, res) => {
  res.json(tracker.STATUSES);
});

function emptyTrackedFields(orderNumber) {
  return {
    order_number: orderNumber,
    web_order_ref: '',
    status: 'Received',
    notes: '',
    eta: '',
    payment_received: 0,
    sales_order_created: 0,
    po_created: 0,
    po_number: '',
    po_supplier_note: '',
    cancel_po_deleted: 0,
    cancel_supplier_cancelled: 0,
    cancel_refund_issued: 0,
    cancel_so_cancelled: 0,
    updated_by: '',
    updated_at: '',
  };
}

router.get('/orders', async (req, res) => {
  try {
    const orders = await accounting.getOrders();
    const statusByOrder = tracker.getAllStatuses();

    const merged = orders.map((order) => {
      const tracked = statusByOrder[order.OrderNumber] || emptyTrackedFields(order.OrderNumber);
      return {
        orderNumber: order.OrderNumber,
        customerName: order.CustomerName,
        orderDate: order.OrderDate,
        total: order.Total,
        webOrderRef: tracked.web_order_ref,
        status: tracked.status,
        notes: tracked.notes,
        eta: tracked.eta,
        paymentReceived: Boolean(tracked.payment_received),
        salesOrderCreated: Boolean(tracked.sales_order_created),
        poCreated: Boolean(tracked.po_created),
        poNumber: tracked.po_number,
        poSupplierNote: tracked.po_supplier_note,
        cancelPoDeleted: Boolean(tracked.cancel_po_deleted),
        cancelSupplierCancelled: Boolean(tracked.cancel_supplier_cancelled),
        cancelRefundIssued: Boolean(tracked.cancel_refund_issued),
        cancelSoCancelled: Boolean(tracked.cancel_so_cancelled),
        updatedBy: tracked.updated_by,
        updatedAt: tracked.updated_at,
        light: tracker.computeLight(tracked),
      };
    });

    res.json({ source: accounting.getSource(), lastImportedAt: accounting.getLastImportedAt(), orders: merged });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load orders from accounting database.' });
  }
});

router.post('/orders/:orderNumber', (req, res) => {
  const { orderNumber } = req.params;
  const { status } = req.body;

  if (!status || !tracker.STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status.' });
  }

  const record = tracker.saveOrder({ orderNumber, ...req.body });
  res.json(record);
});

router.get('/orders/:orderNumber/history', (req, res) => {
  res.json(tracker.getHistory(req.params.orderNumber));
});

module.exports = router;
