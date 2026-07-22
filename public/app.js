const ordersBody = document.getElementById('ordersBody');
const sourceBanner = document.getElementById('sourceBanner');
const userNameInput = document.getElementById('userName');
const historyDialog = document.getElementById('historyDialog');
const historyList = document.getElementById('historyList');
const historyOrderNumber = document.getElementById('historyOrderNumber');
const closeHistoryBtn = document.getElementById('closeHistory');
const importBtn = document.getElementById('importBtn');
const importInput = document.getElementById('importInput');

userNameInput.value = localStorage.getItem('orderTrackerUserName') || '';
userNameInput.addEventListener('input', () => {
  localStorage.setItem('orderTrackerUserName', userNameInput.value);
});

let statuses = [];
const expandedOrders = new Set();

async function loadStatuses() {
  const res = await fetch('/api/statuses');
  statuses = await res.json();
}

function statusOptionsHtml(selected) {
  return statuses
    .map((s) => `<option value="${s}" ${s === selected ? 'selected' : ''}>${s}</option>`)
    .join('');
}

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString();
}

function formatDateTime(value) {
  if (!value) return 'Never';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

function toDateInputValue(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toISOString().slice(0, 10);
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function renderOrders(orders) {
  if (orders.length === 0) {
    ordersBody.innerHTML = '<tr><td colspan="10" class="loading">No orders found.</td></tr>';
    return;
  }

  ordersBody.innerHTML = orders
    .map((order) => {
      const isExpanded = expandedOrders.has(order.orderNumber);
      const isCancelled = order.status === 'Cancelled';
      return `
    <tr data-order-number="${order.orderNumber}">
      <td><span class="light light-${order.light}" title="${order.light}"></span></td>
      <td>${order.orderNumber}</td>
      <td><input type="text" class="web-ref-input" value="${escapeHtml(order.webOrderRef)}" placeholder="Web ref" /></td>
      <td>${escapeHtml(order.customerName)}</td>
      <td>${formatDate(order.orderDate)}</td>
      <td>${Number(order.total).toFixed(2)}</td>
      <td><select class="status-select">${statusOptionsHtml(order.status)}</select></td>
      <td><input type="date" class="eta-input" value="${toDateInputValue(order.eta)}" /></td>
      <td class="updated-meta">${order.updatedBy ? escapeHtml(order.updatedBy) + ' &middot; ' : ''}${formatDateTime(order.updatedAt)}</td>
      <td class="row-actions">
        <button class="save-btn">Save</button>
        <button class="details-btn" type="button">${isExpanded ? 'Hide' : 'Details'}</button>
        <button class="history-btn" type="button">History</button>
      </td>
    </tr>
    <tr class="detail-row ${isExpanded ? '' : 'hidden'}">
      <td colspan="10">
        <div class="detail-panel">
          <div class="detail-section">
            <h4>Milestones</h4>
            <label><input type="checkbox" class="chk-payment" ${order.paymentReceived ? 'checked' : ''} /> Payment received</label>
            <label><input type="checkbox" class="chk-so" ${order.salesOrderCreated ? 'checked' : ''} /> Sales order created</label>
            <label><input type="checkbox" class="chk-po" ${order.poCreated ? 'checked' : ''} /> Purchase order created</label>
            <div class="po-fields">
              <input type="text" class="po-number-input" placeholder="PO #" value="${escapeHtml(order.poNumber)}" />
              <input type="text" class="po-note-input" placeholder="Note for supplier" value="${escapeHtml(order.poSupplierNote)}" />
            </div>
          </div>
          <div class="detail-section cancel-section ${isCancelled ? '' : 'hidden'}">
            <h4>Cancellation checklist</h4>
            <label><input type="checkbox" class="chk-cancel-po" ${order.cancelPoDeleted ? 'checked' : ''} /> PO deleted</label>
            <label><input type="checkbox" class="chk-cancel-supplier" ${order.cancelSupplierCancelled ? 'checked' : ''} /> Order cancelled with supplier</label>
            <label><input type="checkbox" class="chk-cancel-refund" ${order.cancelRefundIssued ? 'checked' : ''} /> Refund issued</label>
            <label><input type="checkbox" class="chk-cancel-so" ${order.cancelSoCancelled ? 'checked' : ''} /> Sales order cancelled in system</label>
          </div>
          <div class="detail-section notes-section">
            <h4>Notes</h4>
            <textarea class="notes-input" placeholder="Notes">${escapeHtml(order.notes)}</textarea>
          </div>
        </div>
      </td>
    </tr>`;
    })
    .join('');
}

function renderSourceBanner(source, lastImportedAt) {
  if (source === 'demo') {
    sourceBanner.hidden = false;
    sourceBanner.textContent = 'Demo mode: no accounting database or imported orders yet. Showing sample orders.';
    return;
  }
  if (source === 'import') {
    sourceBanner.hidden = false;
    sourceBanner.textContent = `Showing orders imported from Excel (last imported ${formatDateTime(lastImportedAt)}). Use "Import orders from Excel" to refresh.`;
    return;
  }
  sourceBanner.hidden = true;
}

async function loadOrders() {
  const res = await fetch('/api/orders');
  const data = await res.json();
  renderSourceBanner(data.source, data.lastImportedAt);
  renderOrders(data.orders);
}

function getDetailRow(mainRow) {
  return mainRow.nextElementSibling;
}

async function saveRow(mainRow) {
  const detailRow = getDetailRow(mainRow);
  const orderNumber = mainRow.dataset.orderNumber;
  const saveBtn = mainRow.querySelector('.save-btn');

  const payload = {
    status: mainRow.querySelector('.status-select').value,
    webOrderRef: mainRow.querySelector('.web-ref-input').value.trim(),
    eta: mainRow.querySelector('.eta-input').value,
    updatedBy: userNameInput.value.trim(),
    notes: detailRow.querySelector('.notes-input').value,
    paymentReceived: detailRow.querySelector('.chk-payment').checked,
    salesOrderCreated: detailRow.querySelector('.chk-so').checked,
    poCreated: detailRow.querySelector('.chk-po').checked,
    poNumber: detailRow.querySelector('.po-number-input').value.trim(),
    poSupplierNote: detailRow.querySelector('.po-note-input').value.trim(),
    cancelPoDeleted: detailRow.querySelector('.chk-cancel-po').checked,
    cancelSupplierCancelled: detailRow.querySelector('.chk-cancel-supplier').checked,
    cancelRefundIssued: detailRow.querySelector('.chk-cancel-refund').checked,
    cancelSoCancelled: detailRow.querySelector('.chk-cancel-so').checked,
  };

  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';

  try {
    const res = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Save failed');
    await loadOrders();
  } catch (err) {
    alert('Could not save this update. Please try again.');
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save';
  }
}

async function showHistory(orderNumber) {
  const res = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}/history`);
  const history = await res.json();
  historyOrderNumber.textContent = orderNumber;
  historyList.innerHTML = history.length
    ? history
        .map(
          (h) =>
            `<li><span class="light light-${h.light}"></span><span><strong>${h.status}</strong> — ${formatDateTime(h.updated_at)}${h.updated_by ? ' by ' + escapeHtml(h.updated_by) : ''}${h.notes ? '<br>' + escapeHtml(h.notes) : ''}</span></li>`
        )
        .join('')
    : '<li>No history yet.</li>';
  historyDialog.showModal();
}

ordersBody.addEventListener('click', (e) => {
  const row = e.target.closest('tr');
  if (!row) return;

  if (e.target.classList.contains('save-btn')) {
    saveRow(row);
  } else if (e.target.classList.contains('history-btn')) {
    showHistory(row.dataset.orderNumber);
  } else if (e.target.classList.contains('details-btn')) {
    const orderNumber = row.dataset.orderNumber;
    const detailRow = getDetailRow(row);
    const nowHidden = detailRow.classList.toggle('hidden');
    e.target.textContent = nowHidden ? 'Details' : 'Hide';
    if (nowHidden) {
      expandedOrders.delete(orderNumber);
    } else {
      expandedOrders.add(orderNumber);
    }
  }
});

ordersBody.addEventListener('change', (e) => {
  if (e.target.classList.contains('status-select')) {
    const row = e.target.closest('tr');
    const detailRow = getDetailRow(row);
    const cancelSection = detailRow.querySelector('.cancel-section');
    const isCancelled = e.target.value === 'Cancelled';
    cancelSection.classList.toggle('hidden', !isCancelled);
    if (isCancelled) {
      const orderNumber = row.dataset.orderNumber;
      expandedOrders.add(orderNumber);
      detailRow.classList.remove('hidden');
      row.querySelector('.details-btn').textContent = 'Hide';
    }
  }
});

closeHistoryBtn.addEventListener('click', () => historyDialog.close());

importBtn.addEventListener('click', () => importInput.click());

importInput.addEventListener('change', async () => {
  const file = importInput.files[0];
  if (!file) return;

  importBtn.disabled = true;
  importBtn.textContent = 'Importing…';

  try {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/import', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Import failed');
    alert(`Imported ${data.imported} order(s), ${data.newOrders} new.`);
    await loadOrders();
  } catch (err) {
    alert(err.message || 'Could not import this file.');
  } finally {
    importBtn.disabled = false;
    importBtn.textContent = 'Import orders from Excel';
    importInput.value = '';
  }
});

(async function init() {
  await loadStatuses();
  await loadOrders();
})();
