'use strict';
/* Narang Textile – Delivery Slip Generator (vanilla JS, no backend) */
const $ = id => document.getElementById(id);
const KEY = { slips: 'nt_slips', custs: 'nt_customers', set: 'nt_settings' };

/* ---------- storage ---------- */
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { toast('Could not save: browser storage is full or blocked.'); return false; } };
const getSlips = () => load(KEY.slips, []);
const getCusts = () => load(KEY.custs, []);
const getSettings = () => ({ name: 'NARANG TEXTILE', addr: '', mobile: '', logo: '', ...load(KEY.set, {}) });

/* ---------- helpers ---------- */
function h(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
function toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 3500); }
const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = d => d ? d.split('-').reverse().join('/') : '';
function newOrderNo() {
  const d = today().replace(/-/g, ''), used = new Set(getSlips().map(s => s.orderNo));
  let n; do { n = `NT-${d}-${Math.floor(1000 + Math.random() * 9000)}`; } while (used.has(n));
  return n;
}
let editingId = null;

/* ---------- navigation ---------- */
function show(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
  document.querySelectorAll('.nav').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  if (view === 'dashboard') renderDashboard();
  if (view === 'history') renderHistory();
  if (view === 'customers') renderCustomers();
  if (view === 'settings') fillSettings();
  if (view === 'create') updatePreview();
  window.scrollTo(0, 0);
}
document.querySelectorAll('.nav').forEach(b => b.onclick = () => show(b.dataset.view));
document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => show(b.dataset.go));

/* ---------- product rows ---------- */
function addRow(p = {}) {
  const r = h('div', 'prow');
  [['Product', 'name', p.name]].forEach(([l, k, v]) => {
    const lb = h('label', '', l), i = h('input'); i.dataset.k = k; i.value = v || ''; lb.append(i); r.append(lb);
  });
  const lq = h('label', '', 'Pcs'), q = h('input'); q.type = 'number'; q.min = 1; q.dataset.k = 'qty'; q.value = p.qty || 1; lq.append(q); r.append(lq);
  const x = h('button', 'btn danger sm', '✕'); x.type = 'button'; x.title = 'Remove';
  x.onclick = () => { if ($('products').children.length > 1) { r.remove(); updatePreview(); } else toast('At least one product is required.'); };
  r.append(x); $('products').append(r);
}
function readProducts() {
  return [...$('products').children].map(r => {
    const o = {}; r.querySelectorAll('input').forEach(i => o[i.dataset.k] = i.value.trim());
    o.qty = parseInt(o.qty, 10) || 0; return o;
  }).filter(p => p.name || p.qty > 1);
}

/* ---------- form <-> data ---------- */
function readForm() {
  const products = readProducts();
  return {
    id: editingId, orderNo: $('orderNo').value, date: $('orderDate').value || today(), ref: $('parcelRef').value.trim(),
    customer: { name: $('cName').value.trim(), mobile: $('cMobile').value.trim(), street: $('cStreet').value.trim(), area: $('cArea').value.trim(), city: $('cCity').value.trim(), state: $('cState').value.trim(), pin: $('cPin').value.trim() },
    products, total: products.reduce((s, p) => s + p.qty, 0), courier: $('courier').value.trim(), awb: $('awb').value.trim()
  };
}
function fillForm(s) {
  editingId = s.id || null;
  $('orderNo').value = s.orderNo; $('orderDate').value = s.date; $('parcelRef').value = s.ref || '';
  const c = s.customer; $('cName').value = c.name; $('cMobile').value = c.mobile; $('cStreet').value = c.street; $('cArea').value = c.area || '';
  $('cCity').value = c.city; $('cState').value = c.state; $('cPin').value = c.pin;
  $('courier').value = s.courier || ''; $('awb').value = s.awb || '';
  $('products').replaceChildren(); (s.products.length ? s.products : [{}]).forEach(addRow); updatePreview();
}
function clearForm() {
  editingId = null; $('slipForm').reset(); $('products').replaceChildren(); addRow();
  $('orderNo').value = newOrderNo(); $('orderDate').value = today(); $('errors').hidden = true; updatePreview();
}
function validate(d) {
  const e = [], c = d.customer;
  if (!c.name) e.push('• Customer name is required.');
  if (!/^\d{10}$/.test(c.mobile)) e.push('• Mobile number must be 10 digits.');
  if (!c.street) e.push('• House number / street is required.');
  if (!c.city) e.push('• City is required.');
  if (!c.state) e.push('• State is required.');
  if (!/^\d{6}$/.test(c.pin)) e.push('• PIN code must be exactly 6 digits.');
  if (!d.products.some(p => p.name && p.qty > 0)) e.push('• Add at least one product with a name and quantity.');
  if (d.products.some(p => p.qty > 1 && !p.name)) e.push('• Every product row needs a product name.');
  const box = $('errors'); box.textContent = e.join('\n'); box.hidden = !e.length;
  return !e.length;
}

/* ---------- QR code (plain text, readable by any scanner app) ---------- */
function qrText(d, s) {
  const c = d.customer, L = [s.name || 'NARANG TEXTILE', 'Order: ' + d.orderNo];
  if (d.awb) L.push('AWB: ' + d.awb);
  L.push('To: ' + c.name, 'Mobile: ' + c.mobile, [c.street, c.area, c.city, c.state].filter(Boolean).join(', ') + ' - ' + c.pin);
  d.products.forEach(p => L.push(p.name + ' x' + p.qty));
  L.push('Total pcs: ' + d.total);
  return L.join('\n').slice(0, 600);
}
function makeQr(d, s) {
  if (typeof qrcode !== 'function') return null;
  try {
    const bytes = new TextEncoder().encode(qrText(d, s)); let str = ''; bytes.forEach(b => str += String.fromCharCode(b));
    const q = qrcode(0, 'M'); q.addData(str, 'Byte'); q.make();
    const doc = new DOMParser().parseFromString(q.createSvgTag({ cellSize: 4, margin: 4, scalable: true }), 'image/svg+xml');
    const svg = document.importNode(doc.documentElement, true);
    if (!svg.getAttribute('viewBox')) svg.setAttribute('viewBox', `0 0 ${parseFloat(svg.getAttribute('width'))} ${parseFloat(svg.getAttribute('height'))}`);
    svg.setAttribute('width', '1.35in'); svg.setAttribute('height', '1.35in'); svg.setAttribute('class', 'qr');
    return svg;
  } catch { return null; }
}

/* ---------- label rendering (safe DOM, no innerHTML) ---------- */
function renderLabel(d, s) {
  const L = $('label'); L.replaceChildren();
  const hdr = h('div', 'hdr');
  if (s.logo) { const im = h('img'); im.src = s.logo; im.alt = ''; hdr.append(im); }
  hdr.append(h('div', 'co', s.name || 'NARANG TEXTILE'));
  const dt = h('div', 'dt'); dt.append(h('div', '', 'Date'), h('b', '', fmtDate(d.date))); hdr.append(dt);

  const bc = h('div', 'bc'), bl = h('div', 'bcl');
  bl.append(h('small', '', 'ORDER NO'), h('div', 'ono', d.orderNo));
  if (d.awb) bl.append(h('small', '', 'AWB / TRACKING'), h('div', 'ono', d.awb));
  bl.append(h('div', 'dt', 'Scan QR for parcel details'));
  bc.append(bl);
  const qr = makeQr(d, s); bc.append(qr || h('div', 'dt', '[QR unavailable – check internet]'));

  const c = d.customer, to = h('div', 'to');
  to.append(h('small', '', 'DELIVER TO:'), h('div', 'nm', c.name || 'Customer name'));
  to.append(h('div', 'ad', [c.street, c.area].filter(Boolean).join(', ') || 'Address'));
  to.append(h('div', 'ad', [c.city, c.state].filter(Boolean).join(', ')));
  to.append(h('div', 'pin', 'PIN: ' + (c.pin || '------')), h('div', 'ph', 'Mobile: ' + (c.mobile || '----------')));

  const items = h('div', 'items'), tb = h('table'), tr = h('tr');
  ['Product', 'Pcs'].forEach(t => tr.append(h('th', '', t)));
  const th = h('thead'); th.append(tr); tb.append(th);
  const body = h('tbody');
  (d.products.length ? d.products : [{ name: '-', qty: 0 }]).forEach(p => {
    const r = h('tr'); [p.name, p.qty || ''].forEach(v => r.append(h('td', '', String(v)))); body.append(r);
  });
  tb.append(body); items.append(tb, h('div', 'tot', 'TOTAL PIECES: ' + d.total + (d.ref ? '   |   Ref: ' + d.ref : '')));

  const cr = h('div', 'cr', d.courier ? 'Courier: ' + d.courier : 'Courier: -');
  const from = h('div', 'from'); from.append(h('b', '', 'FROM: ' + (s.name || 'NARANG TEXTILE')), h('div', '', (s.addr || '').replace(/\n/g, ', ')), h('div', '', s.mobile ? 'Mobile: ' + s.mobile : ''));
  const ft = h('div', 'ft'); ft.append(cr, from);
  L.append(hdr, bc, to, items, ft);
}
function updatePreview() { const d = readForm(); $('totalPieces').textContent = d.total; renderLabel(d, getSettings()); }

/* ---------- save / print ---------- */
function saveOrder(silent) {
  const d = readForm(); if (!validate(d)) return null;
  const slips = getSlips(), i = slips.findIndex(s => s.id === editingId);
  if (i >= 0) slips[i] = { ...d, id: editingId };
  else { d.id = 'id' + Date.now(); editingId = d.id; slips.unshift(d); }
  if (!store(KEY.slips, slips)) return null;
  if ($('saveCust').checked) {
    const cs = getCusts().filter(c => c.mobile !== d.customer.mobile); cs.unshift(d.customer); store(KEY.custs, cs);
  }
  if (!silent) toast('Order ' + d.orderNo + ' saved.');
  return d;
}
function printSlip(pdf) {
  const d = readForm(); if (!validate(d)) return;
  updatePreview();
  if (!saveOrder(true)) return;
  if (pdf) toast('In the print dialog choose "Save as PDF", paper 4 × 6 in, margins None.');
  setTimeout(() => window.print(), pdf ? 900 : 50);
}

/* ---------- history ---------- */
function renderHistory() {
  const q = $('search').value.trim().toLowerCase(), tb = document.querySelector('#histTable tbody'); tb.replaceChildren();
  const list = getSlips().filter(s => !q || [s.orderNo, s.customer.name, s.customer.mobile, s.customer.pin].join(' ').toLowerCase().includes(q));
  if (!list.length) { const r = h('tr'), td = h('td', '', q ? 'No matching slips.' : 'No saved slips yet.'); td.colSpan = 6; r.append(td); tb.append(r); return; }
  list.forEach(s => {
    const r = h('tr'); [s.orderNo, fmtDate(s.date), s.customer.name, s.customer.pin, s.total].forEach(v => r.append(h('td', '', String(v))));
    const a = h('td');
    const mk = (t, fn, c) => { const b = h('button', 'btn sm ' + (c || ''), t); b.type = 'button'; b.onclick = fn; a.append(b); };
    mk('View/Edit', () => { fillForm(s); show('create'); });
    mk('Duplicate', () => { fillForm({ ...s, id: null, orderNo: newOrderNo(), date: today() }); show('create'); toast('Duplicated – save or print when ready.'); });
    mk('Reprint', () => { fillForm(s); show('create'); setTimeout(() => window.print(), 150); });
    mk('Delete', () => { if (confirm('Delete order ' + s.orderNo + '?')) { store(KEY.slips, getSlips().filter(x => x.id !== s.id)); renderHistory(); toast('Deleted.'); } }, 'danger');
    r.append(a); tb.append(r);
  });
}
function csvCell(v) {
  let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}
function exportCsv() {
  const slips = getSlips(); if (!slips.length) return toast('No orders to export.');
  const rows = [['Order No', 'Date', 'Name', 'Mobile', 'Address', 'City', 'State', 'PIN', 'Products', 'Total Pieces', 'Courier', 'AWB', 'Ref']];
  slips.forEach(s => { const c = s.customer; rows.push([s.orderNo, s.date, c.name, c.mobile, [c.street, c.area].filter(Boolean).join(', '), c.city, c.state, c.pin,
    s.products.map(p => `${p.name} x${p.qty}`).join(' ; '), s.total, s.courier, s.awb, s.ref]); });
  const blob = new Blob(['\uFEFF' + rows.map(r => r.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = h('a'); a.href = URL.createObjectURL(blob); a.download = 'narang-orders-' + today() + '.csv'; a.click(); URL.revokeObjectURL(a.href);
}

/* ---------- customers ---------- */
function renderCustomers() {
  const tb = document.querySelector('#custTable tbody'); tb.replaceChildren(); const cs = getCusts();
  if (!cs.length) { const r = h('tr'), td = h('td', '', 'No saved customers yet.'); td.colSpan = 5; r.append(td); tb.append(r); return; }
  cs.forEach(c => {
    const r = h('tr'); [c.name, c.mobile, c.city, c.pin].forEach(v => r.append(h('td', '', v)));
    const a = h('td'), u = h('button', 'btn sm', 'Use for new slip'), d = h('button', 'btn sm danger', 'Delete'); u.type = d.type = 'button';
    u.onclick = () => { clearForm(); $('cName').value = c.name; $('cMobile').value = c.mobile; $('cStreet').value = c.street; $('cArea').value = c.area || ''; $('cCity').value = c.city; $('cState').value = c.state; $('cPin').value = c.pin; show('create'); };
    d.onclick = () => { if (confirm('Delete saved customer ' + c.name + '?')) { store(KEY.custs, getCusts().filter(x => x.mobile !== c.mobile)); renderCustomers(); } };
    a.append(u, d); r.append(a); tb.append(r);
  });
}

/* ---------- dashboard ---------- */
function renderDashboard() {
  const s = getSlips(), st = $('stats'); st.replaceChildren();
  [['Total slips', s.length], ['Created today', s.filter(x => x.date === today()).length], ['Pieces dispatched', s.reduce((n, x) => n + x.total, 0)], ['Saved customers', getCusts().length]]
    .forEach(([l, v]) => { const b = h('div', 'stat'); b.append(h('b', '', String(v)), h('span', '', l)); st.append(b); });
  const rc = $('recent'); rc.replaceChildren();
  if (!s.length) rc.append(h('p', '', 'No slips yet. Create your first delivery slip.'));
  s.slice(0, 5).forEach(x => rc.append(h('p', '', `${x.orderNo} – ${x.customer.name}, ${x.customer.city} (${x.total} pcs)`)));
}

/* ---------- settings ---------- */
let pendingLogo = null;
function fillSettings() {
  const s = getSettings(); $('sName').value = s.name; $('sAddr').value = s.addr; $('sMobile').value = s.mobile; pendingLogo = s.logo;
  $('logoPrev').hidden = !s.logo; if (s.logo) $('logoPrev').src = s.logo; $('settingsMsg').hidden = true;
}
$('sLogo').onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  if (f.size > 500 * 1024) { toast('Logo must be under 500 KB.'); e.target.value = ''; return; }
  const r = new FileReader(); r.onload = () => { pendingLogo = r.result; $('logoPrev').src = pendingLogo; $('logoPrev').hidden = false; }; r.readAsDataURL(f);
};
$('btnLogoRemove').onclick = () => { pendingLogo = ''; $('logoPrev').hidden = true; $('sLogo').value = ''; };
$('settingsForm').onsubmit = e => {
  e.preventDefault(); const m = $('settingsMsg');
  if (!$('sName').value.trim() || !$('sAddr').value.trim()) { m.className = 'msg error'; m.textContent = 'Company name and address are required.'; m.hidden = false; return; }
  if ($('sMobile').value && !/^\d{10}$/.test($('sMobile').value.trim())) { m.className = 'msg error'; m.textContent = 'Sender mobile must be 10 digits.'; m.hidden = false; return; }
  if (store(KEY.set, { name: $('sName').value.trim(), addr: $('sAddr').value.trim(), mobile: $('sMobile').value.trim(), logo: pendingLogo || '' })) {
    m.className = 'msg ok'; m.textContent = 'Settings saved. They will appear on every new slip.'; m.hidden = false;
  }
};

/* ---------- wiring ---------- */
$('slipForm').addEventListener('input', updatePreview);
$('addRow').onclick = () => { addRow(); updatePreview(); };
$('btnGenerate').onclick = () => { const d = readForm(); if (validate(d)) { updatePreview(); toast('Slip generated. Check the preview.'); } };
$('btnSave').onclick = () => saveOrder(false);
$('btnPrint').onclick = () => printSlip(false);
$('btnPdf').onclick = () => printSlip(true);
$('btnClear').onclick = () => { clearForm(); toast('Form cleared.'); };
$('search').oninput = renderHistory;
$('btnCsv').onclick = exportCsv;
['cMobile', 'cPin', 'sMobile'].forEach(id => $(id).addEventListener('input', e => e.target.value = e.target.value.replace(/\D/g, '')));

if (!load(KEY.set, null)) store(KEY.set, getSettings());
clearForm(); renderDashboard();