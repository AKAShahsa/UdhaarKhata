/*
 * Udhaar Khata — pure balance math and formatting.
 * No DOM access here, so it runs in the browser (window.UKMoney) and in node (require).
 * All amounts are integers in minor units (1 Rs = 100).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.UKMoney = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DAY_MS = 86400000;

  // ---------- dates (all as local "YYYY-MM-DD" strings) ----------

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function toISODate(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function parseISODate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    if (!m) return null;
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    if (d.getMonth() !== +m[2] - 1) return null;
    return d;
  }

  function isValidDate(s) { return parseISODate(s) !== null; }

  function addDays(iso, n) {
    var d = parseISODate(iso);
    d.setDate(d.getDate() + n);
    return toISODate(d);
  }

  function daysBetween(fromIso, toIso) {
    var a = parseISODate(fromIso), b = parseISODate(toIso);
    return Math.round((b - a) / DAY_MS);
  }

  // ---------- entries ----------

  function signed(entry) {
    return entry.type === 'gave' ? entry.amount : -entry.amount;
  }

  // Chronological: by date, then by creation time, then id (stable).
  function compareEntries(a, b) {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    var ca = a.createdAt || 0, cb = b.createdAt || 0;
    if (ca !== cb) return ca - cb;
    return String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0;
  }

  function sortEntries(entries) {
    return entries.slice().sort(compareEntries);
  }

  // Returns chronological copies of the entries, each with `balance` after it.
  function runningBalances(entries) {
    var bal = 0;
    return sortEntries(entries).map(function (e) {
      bal += signed(e);
      var copy = {};
      for (var k in e) copy[k] = e[k];
      copy.balance = bal;
      return copy;
    });
  }

  function customerBalance(entries) {
    var bal = 0;
    for (var i = 0; i < entries.length; i++) bal += signed(entries[i]);
    return bal;
  }

  /*
   * Due date of the outstanding balance: payments are applied to the oldest
   * credits first (FIFO). The earliest due date among credits that are still
   * (partly) unpaid is the one that matters.
   */
  function openDueDate(entries) {
    var sorted = sortEntries(entries);
    var paid = 0;
    for (var i = 0; i < sorted.length; i++) if (sorted[i].type === 'got') paid += sorted[i].amount;
    var due = '';
    for (var j = 0; j < sorted.length; j++) {
      var e = sorted[j];
      if (e.type !== 'gave') continue;
      if (paid >= e.amount) { paid -= e.amount; continue; }
      paid = 0;
      if (e.dueDate && (!due || e.dueDate < due)) due = e.dueDate;
    }
    return due;
  }

  function groupByCustomer(entries) {
    var map = {};
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      (map[e.customerId] = map[e.customerId] || []).push(e);
    }
    return map;
  }

  // Per-customer summary used by lists, filters and the dashboard.
  function summarize(customers, entries, today) {
    var byCust = groupByCustomer(entries);
    return customers.map(function (c) {
      var list = byCust[c.id] || [];
      var balance = customerBalance(list);
      var due = balance > 0 ? openDueDate(list) : '';
      var last = '';
      for (var i = 0; i < list.length; i++) if (list[i].date > last) last = list[i].date;
      var status = balance > 0 ? 'owes' : balance < 0 ? 'advance' : 'settled';
      return {
        customer: c,
        balance: balance,
        entryCount: list.length,
        lastActivity: last,
        dueDate: due,
        overdue: balance > 0 && !!due && due < today,
        daysOverdue: balance > 0 && due && due < today ? daysBetween(due, today) : 0,
        status: status
      };
    });
  }

  function matchesFilter(s, filter) {
    switch (filter) {
      case 'owes': return s.balance > 0;
      case 'overdue': return s.overdue;
      case 'settled': return s.balance <= 0;
      default: return true;
    }
  }

  function filterSummaries(summaries, opts) {
    opts = opts || {};
    var q = (opts.query || '').trim().toLowerCase();
    var qDigits = q.replace(/\D/g, '');
    var out = summaries.filter(function (s) {
      if (!matchesFilter(s, opts.filter || 'all')) return false;
      if (!q) return true;
      var c = s.customer;
      if ((c.name || '').toLowerCase().indexOf(q) !== -1) return true;
      if ((c.note || '').toLowerCase().indexOf(q) !== -1) return true;
      return !!qDigits && (c.phone || '').replace(/\D/g, '').indexOf(qDigits) !== -1;
    });
    var sort = opts.sort || 'balance';
    out.sort(function (a, b) {
      if (sort === 'name') return a.customer.name.localeCompare(b.customer.name);
      if (sort === 'recent') {
        var la = a.lastActivity || '', lb = b.lastActivity || '';
        if (la !== lb) return la < lb ? 1 : -1;
        return (b.customer.createdAt || 0) - (a.customer.createdAt || 0);
      }
      if (b.balance !== a.balance) return b.balance - a.balance;
      return a.customer.name.localeCompare(b.customer.name);
    });
    return out;
  }

  // 30 (or n) daily buckets ending today: [{date, gave, got}]
  function dailySeries(entries, today, days) {
    days = days || 30;
    var start = addDays(today, -(days - 1));
    var buckets = [], index = {};
    for (var i = 0; i < days; i++) {
      var d = addDays(start, i);
      index[d] = buckets.length;
      buckets.push({ date: d, gave: 0, got: 0 });
    }
    for (var j = 0; j < entries.length; j++) {
      var e = entries[j];
      if (!(e.date in index)) continue;
      buckets[index[e.date]][e.type] += e.amount;
    }
    return buckets;
  }

  function dashboardStats(customers, entries, today) {
    var summaries = summarize(customers, entries, today);
    var month = today.slice(0, 7);
    var totalToCollect = 0, withDues = 0, collectedThisMonth = 0, givenThisMonth = 0;
    var givenToday = 0, collectedToday = 0, entriesToday = 0;
    summaries.forEach(function (s) {
      if (s.balance > 0) { totalToCollect += s.balance; withDues++; }
    });
    var known = {};
    customers.forEach(function (c) { known[c.id] = true; });
    entries.forEach(function (e) {
      if (!known[e.customerId]) return;
      if (e.date === today) {
        entriesToday++;
        if (e.type === 'got') collectedToday += e.amount;
        else givenToday += e.amount;
      }
      if (e.date.slice(0, 7) !== month) return;
      if (e.type === 'got') collectedThisMonth += e.amount;
      else givenThisMonth += e.amount;
    });
    var overdue = summaries.filter(function (s) { return s.overdue; })
      .sort(function (a, b) { return b.daysOverdue - a.daysOverdue || b.balance - a.balance; });
    var topDebtors = summaries.filter(function (s) { return s.balance > 0; })
      .sort(function (a, b) { return b.balance - a.balance; })
      .slice(0, 5);
    return {
      totalToCollect: totalToCollect,
      collectedThisMonth: collectedThisMonth,
      givenThisMonth: givenThisMonth,
      givenToday: givenToday,
      collectedToday: collectedToday,
      entriesToday: entriesToday,
      customersWithDues: withDues,
      overdue: overdue,
      topDebtors: topDebtors,
      series: dailySeries(entries.filter(function (e) { return known[e.customerId]; }), today, 30)
    };
  }

  // ---------- money formatting / parsing ----------

  function groupDigits(intStr) {
    return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  // 1250000 -> "Rs 12,500"; 1250050 -> "Rs 12,500.50"; -50000 -> "-Rs 500"
  function formatMoney(minor, currency) {
    if (currency === undefined) currency = 'Rs';
    minor = Math.round(minor || 0);
    var neg = minor < 0;
    var abs = Math.abs(minor);
    var whole = Math.floor(abs / 100), frac = abs % 100;
    var num = groupDigits(String(whole)) + (frac ? '.' + pad(frac) : '');
    var cur = currency ? currency + ' ' : '';
    return (neg ? '-' : '') + cur + num;
  }

  // Compact for chart axes: 1500000 -> "15k"
  function formatCompact(minor) {
    var v = Math.round(minor / 100);
    if (v >= 10000000) return trim(v / 10000000) + 'Cr';
    if (v >= 100000) return trim(v / 100000) + 'L';
    if (v >= 1000) return trim(v / 1000) + 'k';
    return String(v);
    function trim(x) { return (Math.round(x * 10) / 10).toString(); }
  }

  // "12,500" / "12500.5" -> minor units; invalid, zero or negative -> null
  function parseAmount(input) {
    if (typeof input === 'number') input = String(input);
    var s = String(input || '').replace(/[\s,]/g, '');
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
    var parts = s.split('.');
    var whole = parseInt(parts[0], 10);
    var frac = parts[1] ? parseInt((parts[1] + '0').slice(0, 2), 10) : 0;
    var minor = whole * 100 + frac;
    if (!minor || minor > 1e13) return null;
    return minor;
  }

  // Minor units -> plain editable string: 1250050 -> "12500.5"
  function toInputValue(minor) {
    var whole = Math.floor(minor / 100), frac = minor % 100;
    if (!frac) return String(whole);
    return whole + '.' + pad(frac).replace(/0$/, '');
  }

  function fillTemplate(tpl, vars) {
    return String(tpl || '').replace(/\{(\w+)\}/g, function (m, key) {
      return Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : m;
    });
  }

  // "0300-1234567" + "92" -> "923001234567"
  function waPhone(phone, countryCode) {
    var d = String(phone || '').replace(/\D/g, '');
    if (!d) return '';
    var cc = String(countryCode || '').replace(/\D/g, '');
    if (String(phone).trim().charAt(0) === '+') return d;
    if (d.indexOf('00') === 0) return d.slice(2);
    if (d.charAt(0) === '0') return cc + d.slice(1);
    if (cc && d.indexOf(cc) === 0 && d.length > 10) return d;
    return cc + d;
  }

  function formatDate(iso) {
    var d = parseISODate(iso);
    if (!d) return '';
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
  }

  return {
    toISODate: toISODate,
    parseISODate: parseISODate,
    isValidDate: isValidDate,
    addDays: addDays,
    daysBetween: daysBetween,
    sortEntries: sortEntries,
    runningBalances: runningBalances,
    customerBalance: customerBalance,
    openDueDate: openDueDate,
    summarize: summarize,
    filterSummaries: filterSummaries,
    dailySeries: dailySeries,
    dashboardStats: dashboardStats,
    formatMoney: formatMoney,
    formatCompact: formatCompact,
    parseAmount: parseAmount,
    toInputValue: toInputValue,
    fillTemplate: fillTemplate,
    waPhone: waPhone,
    formatDate: formatDate
  };
});
