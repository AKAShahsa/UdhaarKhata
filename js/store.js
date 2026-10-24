/*
 * Udhaar Khata — data model, persistence, backup/restore, CSV and demo data.
 * Browser: window.UKStore. Node: require('./store.js') (storage is injected).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./money.js'));
  else root.UKStore = factory(root.UKMoney);
})(typeof self !== 'undefined' ? self : this, function (M) {
  'use strict';

  var KEY = 'udhaarkhata.v1';
  var VERSION = 1;

  var DEFAULT_TEMPLATE =
    'Assalam-o-Alaikum {name},\n' +
    'This is a friendly reminder from {shop}. Your pending balance is {balance}{due}.\n' +
    'Please pay at your earliest convenience. Thank you!';

  function defaultSettings() {
    return {
      shopName: 'My Shop',
      shopPhone: '',
      currency: 'Rs',
      countryCode: '92',
      template: DEFAULT_TEMPLATE,
      pinHash: '',
      theme: 'system'
    };
  }

  function emptyData() {
    return { version: VERSION, settings: defaultSettings(), customers: [], entries: [] };
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // ---------- validation / normalisation ----------

  function str(v, max) { return String(v == null ? '' : v).slice(0, max || 500); }

  /*
   * Validates and cleans a parsed backup object. Returns {ok, data} or {ok:false, error}.
   * Entries pointing at unknown customers are dropped.
   */
  function normalize(raw) {
    if (!raw || typeof raw !== 'object') return { ok: false, error: 'File is not a Udhaar Khata backup.' };
    if (!Array.isArray(raw.customers) || !Array.isArray(raw.entries)) {
      return { ok: false, error: 'Backup is missing customers or entries.' };
    }
    if (raw.version && raw.version > VERSION) {
      return { ok: false, error: 'Backup was made by a newer version of the app.' };
    }
    var settings = defaultSettings();
    var rs = raw.settings || {};
    Object.keys(settings).forEach(function (k) {
      if (typeof rs[k] === 'string') settings[k] = str(rs[k], k === 'template' ? 2000 : 200);
    });
    if (['system', 'light', 'dark'].indexOf(settings.theme) === -1) settings.theme = 'system';

    var ids = {};
    var customers = [];
    for (var i = 0; i < raw.customers.length; i++) {
      var c = raw.customers[i];
      if (!c || !c.id || !String(c.name || '').trim()) continue;
      var id = str(c.id, 64);
      if (ids[id]) continue;
      ids[id] = true;
      customers.push({
        id: id,
        name: str(c.name, 100).trim(),
        phone: str(c.phone, 30).trim(),
        note: str(c.note, 300),
        createdAt: +c.createdAt || Date.now(),
        updatedAt: +c.updatedAt || +c.createdAt || Date.now()
      });
    }
    var entries = [];
    var entryIds = {};
    for (var j = 0; j < raw.entries.length; j++) {
      var e = raw.entries[j];
      if (!e || !ids[e.customerId]) continue;
      if (e.type !== 'gave' && e.type !== 'got') continue;
      var amount = Math.round(+e.amount);
      if (!(amount > 0) || !M.isValidDate(e.date)) continue;
      var eid = e.id ? str(e.id, 64) : uid();
      if (entryIds[eid]) eid = uid();
      entryIds[eid] = true;
      entries.push({
        id: eid,
        customerId: str(e.customerId, 64),
        type: e.type,
        amount: amount,
        date: e.date,
        dueDate: e.type === 'gave' && M.isValidDate(e.dueDate) ? e.dueDate : '',
        note: str(e.note, 300),
        createdAt: +e.createdAt || Date.now()
      });
    }
    return { ok: true, data: { version: VERSION, settings: settings, customers: customers, entries: entries } };
  }

  function parseBackup(text) {
    var raw;
    try { raw = JSON.parse(text); } catch (err) { return { ok: false, error: 'File is not valid JSON.' }; }
    return normalize(raw);
  }

  function serialize(data) {
    return JSON.stringify(data, null, 2);
  }

  // ---------- persistence ----------

  function load(storage) {
    try {
      var text = storage.getItem(KEY);
      if (!text) return emptyData();
      var res = parseBackup(text);
      return res.ok ? res.data : emptyData();
    } catch (err) {
      return emptyData();
    }
  }

  function save(storage, data) {
    storage.setItem(KEY, JSON.stringify(data));
  }

  // ---------- CSV ----------

  function csvCell(v) {
    var s = String(v == null ? '' : v);
    // Guard against spreadsheet formula injection.
    if (/^[=+\-@\t\r]/.test(s) && !/^-\d+(\.\d+)?$/.test(s)) s = "'" + s;
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function toCSV(data) {
    var byId = {};
    data.customers.forEach(function (c) { byId[c.id] = c; });
    var rows = [['Customer', 'Phone', 'Date', 'Type', 'Amount', 'Due date', 'Note', 'Balance after']];
    var grouped = {};
    data.entries.forEach(function (e) {
      if (byId[e.customerId]) (grouped[e.customerId] = grouped[e.customerId] || []).push(e);
    });
    data.customers.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).forEach(function (c) {
      M.runningBalances(grouped[c.id] || []).forEach(function (e) {
        rows.push([
          c.name, c.phone, e.date,
          e.type === 'gave' ? 'You gave' : 'You got',
          M.toInputValue(e.amount), e.dueDate, e.note, (e.balance < 0 ? '-' : '') + M.toInputValue(Math.abs(e.balance))
        ]);
      });
    });
    return rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n') + '\r\n';
  }

  // ---------- demo data ----------

  function demoData(today, settings) {
    var d = function (n) { return M.addDays(today, n); };
    var people = [
      ['Ahmed Raza', '0300-1234567', 'Lives near the mosque'],
      ['Fatima Bibi', '0321-7654321', 'Pays every Friday'],
      ['Bilal Khan', '0333-5558899', 'Tea stall owner'],
      ['Sana Tariq', '0345-1112233', ''],
      ['Usman Ali', '0312-9988776', 'Monthly grocery'],
      ['Ayesha Noor', '', 'New customer'],
      ['Hamza Sheikh', '0301-4445566', '']
    ];
    var now = Date.now();
    var customers = people.map(function (p, i) {
      return { id: 'demo-c' + i, name: p[0], phone: p[1], note: p[2], createdAt: now - (60 - i) * 86400000, updatedAt: now };
    });
    // [customerIndex, type, amountRs, dayOffset, note, dueOffset]
    var raw = [
      [0, 'gave', 4500, -40, 'Flour 20kg, oil', -25],
      [0, 'got', 2000, -30, 'Cash'],
      [0, 'gave', 3200, -18, 'Rice and sugar', -4],
      [0, 'gave', 1800, -6, 'Tea, milk powder', 8],
      [1, 'gave', 2500, -28, 'Groceries', -21],
      [1, 'got', 2500, -21, 'Paid in full'],
      [1, 'gave', 1750, -9, 'Soap, detergent', 5],
      [1, 'got', 1000, -2, 'Partial payment'],
      [2, 'gave', 12500, -35, 'Sugar 50kg for stall', -10],
      [2, 'got', 3000, -20, 'Cash'],
      [2, 'gave', 2600, -12, 'Tea leaves', -1],
      [2, 'got', 1500, -3, 'Easypaisa'],
      [3, 'gave', 900, -15, 'Biscuits, juice'],
      [3, 'got', 900, -11, 'Paid'],
      [4, 'gave', 8400, -29, 'Monthly grocery', -1],
      [4, 'got', 5000, -24, 'Bank transfer'],
      [4, 'gave', 7600, -5, 'Monthly grocery', 25],
      [5, 'gave', 650, -1, 'Eggs, bread', 6],
      [6, 'gave', 3000, -26, 'Cooking oil', -12],
      [6, 'got', 3500, -8, 'Paid extra as advance']
    ];
    var entries = raw.map(function (r, i) {
      return {
        id: 'demo-e' + i,
        customerId: 'demo-c' + r[0],
        type: r[1],
        amount: r[2] * 100,
        date: d(r[3]),
        dueDate: r[5] != null ? d(r[5]) : '',
        note: r[4],
        createdAt: now - (100 - i) * 1000
      };
    });
    var s = settings || defaultSettings();
    if (!s.shopName || s.shopName === 'My Shop') s.shopName = 'Madina General Store';
    return { version: VERSION, settings: s, customers: customers, entries: entries };
  }

  return {
    KEY: KEY,
    VERSION: VERSION,
    DEFAULT_TEMPLATE: DEFAULT_TEMPLATE,
    defaultSettings: defaultSettings,
    emptyData: emptyData,
    uid: uid,
    normalize: normalize,
    parseBackup: parseBackup,
    serialize: serialize,
    load: load,
    save: save,
    csvCell: csvCell,
    toCSV: toCSV,
    demoData: demoData
  };
});
