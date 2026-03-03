/**
 * Google Apps Script (Web App) to append app events into Google Sheets.
 *
 * Setup:
 * - Create a Google Sheet (example: "Pradeep Electronics")
 * - Extensions → Apps Script → paste this code
 * - Deploy → New deployment → Type: Web app
 *   - Execute as: Me
 *   - Who has access: Anyone (or Anyone with the link)
 * - Copy the Web App URL into your Vite `.env`:
 *   VITE_GOOGLE_SHEETS_SYNC_ENABLED=true
 *   VITE_GOOGLE_SHEETS_WEBAPP_URL=https://script.google.com/macros/s/XXXX/exec
 */
function doPost(e) {
  try {
    var payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var type = String(payload.type || '').toLowerCase();
    var action = String(payload.action || '');
    var at = String(payload.at || new Date().toISOString());

    if (type === 'sale' && payload.sale) {
      appendSale_(at, action, payload.sale);
      return json_({ ok: true });
    }

    if (type === 'product') {
      appendProduct_(at, action, payload);
      return json_({ ok: true });
    }

    appendLog_(at, type || 'unknown', action, payload);
    return json_({ ok: true, logged: true });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) }, 500);
  }
}

function doGet() {
  return json_({ ok: true, message: 'Google Sheets sync endpoint is running.' });
}

function appendSale_(at, action, sale) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getOrCreateSheet_(ss, 'Sales');
  ensureHeader_(sheet, [
    'Synced At',
    'Action',
    'Invoice ID',
    'Invoice Date',
    'Customer',
    'Payment Mode',
    'Subtotal',
    'Discount Mode',
    'Discount %',
    'Discount Amount',
    'Include GST',
    'GST %',
    'GST Amount',
    'Grand Total',
    'Items JSON'
  ]);

  sheet.appendRow([
    at,
    action || 'create',
    sale.id || '',
    sale.date || '',
    sale.customerName || '',
    sale.paymentMode || '',
    n_(sale.subtotal),
    sale.discountMode || '',
    n_(sale.discountPercent),
    n_(sale.discountTotal),
    sale.includeGst === false ? 'No' : 'Yes',
    n_(sale.gstPercent),
    n_(sale.gstTotal),
    n_(sale.grandTotal),
    JSON.stringify(sale.items || [])
  ]);
}

function appendProduct_(at, action, payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getOrCreateSheet_(ss, 'ProductsLog');
  ensureHeader_(sheet, [
    'Synced At',
    'Action',
    'Product ID',
    'Name',
    'Category',
    'Brand',
    'Unit',
    'Purchase Price',
    'Selling Price',
    'GST %',
    'Stock',
    'Reorder Level',
    'HSN',
    'Raw JSON'
  ]);

  var p = payload.product || {};
  sheet.appendRow([
    at,
    action || '',
    payload.productId || p.id || '',
    p.name || '',
    p.category || '',
    p.brand || '',
    p.unit || '',
    n_(p.purchasePrice),
    n_(p.sellingPrice),
    n_(p.gst),
    n_(p.stock),
    n_(p.reorderLevel),
    p.hsn || '',
    JSON.stringify(payload)
  ]);
}

function appendLog_(at, type, action, payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getOrCreateSheet_(ss, 'Logs');
  ensureHeader_(sheet, ['Synced At', 'Type', 'Action', 'Raw JSON']);
  sheet.appendRow([at, type || '', action || '', JSON.stringify(payload || {})]);
}

function getOrCreateSheet_(ss, name) {
  var sheet = ss.getSheetByName(name);
  return sheet || ss.insertSheet(name);
}

function ensureHeader_(sheet, headers) {
  if (sheet.getLastRow() > 0) return;
  sheet.appendRow(headers);
  sheet.setFrozenRows(1);
}

function n_(val) {
  var num = Number(val);
  return isFinite(num) ? num : 0;
}

function json_(obj, status) {
  if (status) obj.status = status;
  var output = ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}

