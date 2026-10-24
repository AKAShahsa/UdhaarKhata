/* Udhaar Khata — UI layer. Depends on window.UKMoney (M) and window.UKStore (S). */
(function () {
  'use strict';

  var M = window.UKMoney;
  var S = window.UKStore;

  var data = S.load(localStorage);
  var ui = { filter: 'all', sort: 'balance', query: '', stFrom: '', stTo: '' };
  var view = document.getElementById('view');
  var sheetRoot = document.getElementById('sheet-root');
  var navigatedInApp = false;

  // ---------- helpers ----------

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function today() { return M.toISODate(new Date()); }
  function money(minor) { return M.formatMoney(minor, data.settings.currency); }

  function persist() {
    try {
      S.save(localStorage, data);
      return true;
    } catch (err) {
      toast('Could not save — device storage may be full.');
      return false;
    }
  }

  function findCustomer(id) {
    for (var i = 0; i < data.customers.length; i++) if (data.customers[i].id === id) return data.customers[i];
    return null;
  }

  function entriesOf(id) {
    return data.entries.filter(function (e) { return e.customerId === id; });
  }

  function summaryOf(c) {
    return M.summarize([c], entriesOf(c.id), today())[0];
  }

  function initials(name) {
    var parts = String(name).trim().split(/\s+/);
    return ((parts[0] || '')[0] || '?').toUpperCase() + ((parts[1] || '')[0] || '').toUpperCase();
  }

  function balanceLabel(s) {
    if (s.balance > 0) return 'You will get';
    if (s.balance < 0) return 'Advance (you owe)';
    return 'Settled';
  }

  function dueBadge(s) {
    if (s.overdue) return '<span class="badge overdue">Overdue ' + s.daysOverdue + 'd</span>';
    if (s.dueDate) {
      var days = M.daysBetween(today(), s.dueDate);
      return '<span class="badge due">' + (days === 0 ? 'Due today' : 'Due in ' + days + 'd') + '</span>';
    }
    return '';
  }

  var toastTimer;
  function toast(msg) {
    var el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2600);
  }

  function download(filename, text, type) {
    var blob = new Blob([text], { type: type });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1000);
  }

  var ICONS = {
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
    wa: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 20.5l1.3-4.2A8.5 8.5 0 1112 20.5a8.6 8.6 0 01-4.1-1z"/><path d="M9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.6-2-1-1 .8a4.6 4.6 0 01-2.7-2.7l.8-1-1-2z"/></svg>',
    phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2"/></svg>',
    doc: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>',
    edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/></svg>',
    trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
    print: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/></svg>',
    users: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 010 6.8M18 14.8c1.8.7 3 2.4 3.5 5.2"/></svg>',
    book: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2z"/><path d="M4 19V5M9 8h6"/></svg>',
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 12h12"/><path d="M15 6l6 6-6 6"/></svg>',
    del: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 5H9l-6 7 6 7h12z"/><path d="M17 9l-6 6M11 9l6 6"/></svg>'
  };

  // ---------- theme ----------

  function applyTheme() {
    var t = data.settings.theme;
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
    else document.documentElement.removeAttribute('data-theme');
  }

  // ---------- app bar ----------

  function setBar(title, subtitle, actionsHtml, showBack) {
    $('#page-title').textContent = title;
    $('#page-subtitle').textContent = subtitle || '';
    $('#appbar-actions').innerHTML = actionsHtml || '';
    $('#back-btn').hidden = !showBack;
    $('#appbar').classList.toggle('has-back', !!showBack);
    document.title = title === 'Udhaar Khata' ? 'Udhaar Khata' : title + ' · Udhaar Khata';
  }

  // ---------- router ----------

  function parseRoute() {
    var h = (location.hash || '#/').replace(/^#/, '');
    var parts = h.split('/').filter(Boolean);
    return { name: parts[0] || 'home', id: parts[1] ? decodeURIComponent(parts[1]) : null };
  }

  function go(hash) {
    navigatedInApp = true;
    if (location.hash === hash) render();
    else location.hash = hash;
  }

  function render() {
    var r = parseRoute();
    var detail = r.name === 'customer' || r.name === 'statement';
    document.body.classList.toggle('detail', detail);
    $all('.bottom-nav a').forEach(function (a) {
      var on = a.getAttribute('data-nav') === r.name;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    switch (r.name) {
      case 'customers': renderCustomers(); break;
      case 'customer': renderCustomer(r.id); break;
      case 'statement': renderStatement(r.id); break;
      case 'settings': renderSettings(); break;
      default: renderDashboard();
    }
  }

  // ---------- dashboard ----------

  function renderDashboard() {
    setBar(data.settings.shopName || 'Udhaar Khata', 'Udhaar Khata · ' + M.formatDate(today()));
    if (!data.customers.length) {
      view.innerHTML =
        '<div class="card empty">' +
        '<div class="art">' + ICONS.book + '</div>' +
        '<h2>Welcome to Udhaar Khata</h2>' +
        '<p>Add customers and record what you give on credit and what you receive. Everything stays on this phone.</p>' +
        '<div class="btn-row">' +
        '<button class="btn primary" data-action="add-customer">' + ICONS.plus + 'Add customer</button>' +
        '<button class="btn" data-action="demo">Load demo data</button>' +
        '</div></div>';
      return;
    }
    var st = M.dashboardStats(data.customers, data.entries, today());
    var monthName = new Date().toLocaleString('en-US', { month: 'long' });
    var html = '<div class="stack">';
    html +=
      '<div class="stats">' +
      '<div class="card stat hero"><div class="stat-label">Total to collect</div>' +
      '<div class="stat-value">' + esc(money(st.totalToCollect)) + '</div>' +
      '<div class="stat-foot">from ' + st.customersWithDues + ' customer' + (st.customersWithDues === 1 ? '' : 's') + '</div></div>' +
      '<div class="card stat"><div class="stat-label">Collected in ' + esc(monthName) + '</div>' +
      '<div class="stat-value" style="color:var(--got)">' + esc(money(st.collectedThisMonth)) + '</div>' +
      '<div class="stat-foot">Given: ' + esc(money(st.givenThisMonth)) + '</div></div>' +
      '<div class="card stat"><div class="stat-label">Customers with dues</div>' +
      '<div class="stat-value">' + st.customersWithDues + '</div>' +
      '<div class="stat-foot">' + st.overdue.length + ' overdue</div></div>' +
      '<div class="card stat today"><div class="stat-label">Today</div>' +
      '<div class="today-split">' +
      '<div><div class="stat-foot">You gave</div><div class="stat-value" style="color:var(--gave)">' + esc(money(st.givenToday)) + '</div></div>' +
      '<div><div class="stat-foot">You got</div><div class="stat-value" style="color:var(--got)">' + esc(money(st.collectedToday)) + '</div></div>' +
      '</div><div class="stat-foot">' + (st.entriesToday ? st.entriesToday + ' entr' + (st.entriesToday === 1 ? 'y' : 'ies') + ' today' : 'No entries yet today') + '</div></div>' +
      '</div>';

    html += '<section class="card chart" aria-labelledby="chart-title">' +
      '<h2 class="card-title" id="chart-title">Last 30 days</h2>' + chartSvg(st.series) + '</section>';

    html += '<section class="card flush"><h2 class="card-title">Overdue' +
      (st.overdue.length ? ' <a href="#/customers" data-filter-link="overdue">See all</a>' : '') + '</h2>';
    if (st.overdue.length) {
      html += '<ul class="list">' + st.overdue.slice(0, 6).map(function (s) {
        return '<li>' + customerRow(s, 'Due ' + M.formatDate(s.dueDate) + ' · ' + s.daysOverdue + ' day' + (s.daysOverdue === 1 ? '' : 's') + ' late') + '</li>';
      }).join('') + '</ul>';
    } else {
      html += '<p class="muted" style="padding:0 16px 16px;margin:0">No overdue payments. Nice!</p>';
    }
    html += '</section>';

    html += '<section class="card flush"><h2 class="card-title">Top 5 debtors' +
      (st.topDebtors.length ? ' <a href="#/customers" data-filter-link="owes">See all</a>' : '') + '</h2>';
    if (st.topDebtors.length) {
      html += '<ul class="list">' + st.topDebtors.map(function (s, i) {
        return '<li><a class="row" href="#/customer/' + encodeURIComponent(s.customer.id) + '">' +
          '<span class="rank">' + (i + 1) + '</span>' +
          '<span class="row-main"><span class="row-title">' + esc(s.customer.name) + '</span>' +
          '<span class="row-sub">' + (s.lastActivity ? 'Last entry ' + esc(M.formatDate(s.lastActivity)) : '') + '</span></span>' +
          '<span class="row-end"><span class="amount owes">' + esc(money(s.balance)) + '</span></span></a></li>';
      }).join('') + '</ul>';
    } else {
      html += '<p class="muted" style="padding:0 16px 16px;margin:0">Nobody owes you anything right now.</p>';
    }
    html += '</section></div>';
    html += '<button class="fab" data-action="add-customer">' + ICONS.plus + 'Add customer</button>';
    view.innerHTML = html;
  }

  function chartSvg(series) {
    var W = 340, H = 180, padL = 34, padR = 6, padT = 10, padB = 24;
    var plotW = W - padL - padR, plotH = H - padT - padB;
    var max = 0, totalGave = 0, totalGot = 0;
    series.forEach(function (d) {
      max = Math.max(max, d.gave, d.got);
      totalGave += d.gave;
      totalGot += d.got;
    });
    var niceMax = niceCeil(max || 100000);
    var slot = plotW / series.length;
    var bw = Math.max(1.5, (slot - 2) / 2);
    var y = function (v) { return padT + plotH - (v / niceMax) * plotH; };
    var out = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-labelledby="chart-desc">' +
      '<title id="chart-desc">Credit given vs payments received per day for the last 30 days. Total given ' +
      esc(money(totalGave)) + ', total received ' + esc(money(totalGot)) + '.</title>';
    [0, 0.5, 1].forEach(function (f) {
      var gy = y(niceMax * f);
      out += '<line class="grid" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + gy + '" y2="' + gy + '"/>' +
        '<text class="axis-label" x="' + (padL - 5) + '" y="' + (gy + 3) + '" text-anchor="end">' + M.formatCompact(niceMax * f) + '</text>';
    });
    series.forEach(function (d, i) {
      var x = padL + i * slot + 1;
      var tip = M.formatDate(d.date) + ' — Gave ' + money(d.gave) + ', Got ' + money(d.got);
      if (d.gave) out += '<rect class="bar-gave" x="' + x.toFixed(1) + '" y="' + y(d.gave).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + (padT + plotH - y(d.gave)).toFixed(1) + '" rx="1"><title>' + esc(tip) + '</title></rect>';
      if (d.got) out += '<rect class="bar-got" x="' + (x + bw).toFixed(1) + '" y="' + y(d.got).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + (padT + plotH - y(d.got)).toFixed(1) + '" rx="1"><title>' + esc(tip) + '</title></rect>';
      if ((i % 7 === 0 && i < series.length - 4) || i === series.length - 1) {
        var dt = M.parseISODate(d.date);
        out += '<text class="axis-label" x="' + (x + bw).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle">' +
          dt.getDate() + ' ' + dt.toLocaleString('en-US', { month: 'short' }) + '</text>';
      }
    });
    out += '</svg>';
    out += '<div class="legend"><span><i style="background:var(--gave)"></i>You gave <strong>' + esc(money(totalGave)) + '</strong></span>' +
      '<span><i style="background:var(--got)"></i>You got <strong>' + esc(money(totalGot)) + '</strong></span></div>';
    return out;
  }

  function niceCeil(v) {
    var pow = Math.pow(10, Math.floor(Math.log10(v)));
    var steps = [1, 2, 2.5, 5, 10];
    for (var i = 0; i < steps.length; i++) if (steps[i] * pow >= v) return steps[i] * pow;
    return 10 * pow;
  }

  function customerRow(s, sub) {
    var c = s.customer;
    return '<a class="row" href="#/customer/' + encodeURIComponent(c.id) + '">' +
      '<span class="avatar" aria-hidden="true">' + esc(initials(c.name)) + '</span>' +
      '<span class="row-main"><span class="row-title">' + esc(c.name) + '</span>' +
      '<span class="row-sub">' + esc(sub != null ? sub : (c.phone || c.note || 'No phone')) + '</span></span>' +
      '<span class="row-end"><span class="amount ' + s.status + '">' + esc(money(Math.abs(s.balance))) + '</span>' +
      '<span class="amount-sub">' + (s.status === 'owes' ? (dueBadge(s) || 'To collect') : s.status === 'advance' ? 'Advance' : 'Settled') + '</span></span></a>';
  }

  // ---------- customers ----------

  function renderCustomers() {
    setBar('Customers', data.customers.length + ' customer' + (data.customers.length === 1 ? '' : 's'));
    if (!data.customers.length) {
      view.innerHTML =
        '<div class="card empty"><div class="art">' + ICONS.users + '</div>' +
        '<h2>No customers yet</h2><p>Add your first customer to start recording udhaar.</p>' +
        '<div class="btn-row"><button class="btn primary" data-action="add-customer">' + ICONS.plus + 'Add customer</button>' +
        '<button class="btn" data-action="demo">Load demo data</button></div></div>';
      return;
    }
    var filters = [['all', 'All'], ['owes', 'Owes me'], ['overdue', 'Overdue'], ['settled', 'Settled']];
    view.innerHTML =
      '<div class="toolbar">' +
      '<label class="search">' + ICONS.search +
      '<input id="search" type="search" placeholder="Search name, phone or note" autocomplete="off" value="' + esc(ui.query) + '" aria-label="Search customers"></label>' +
      '<div class="chips" role="group" aria-label="Filter">' + filters.map(function (f) {
        return '<button class="chip" data-filter="' + f[0] + '" aria-pressed="' + (ui.filter === f[0]) + '">' + f[1] + '<span class="count" data-count="' + f[0] + '"></span></button>';
      }).join('') + '</div></div>' +
      '<div class="list-meta"><span id="result-count"></span>' +
      '<label>Sort: <select id="sort" aria-label="Sort customers">' +
      '<option value="balance">Highest balance</option><option value="name">Name A–Z</option><option value="recent">Recent activity</option>' +
      '</select></label></div>' +
      '<div class="card flush"><ul class="list" id="customer-list"></ul></div>' +
      '<button class="fab" data-action="add-customer">' + ICONS.plus + 'Add customer</button>';
    $('#sort').value = ui.sort;
    renderCustomerList();
  }

  function renderCustomerList() {
    var all = M.summarize(data.customers, data.entries, today());
    ['all', 'owes', 'overdue', 'settled'].forEach(function (f) {
      var n = M.filterSummaries(all, { filter: f }).length;
      var el = $('[data-count="' + f + '"]');
      if (el) el.textContent = n;
    });
    var list = M.filterSummaries(all, { filter: ui.filter, sort: ui.sort, query: ui.query });
    var total = list.reduce(function (sum, s) { return sum + Math.max(0, s.balance); }, 0);
    $('#result-count').textContent = list.length + ' shown' + (total ? ' · ' + money(total) + ' due' : '');
    $('#customer-list').innerHTML = list.length
      ? list.map(function (s) { return '<li>' + customerRow(s) + '</li>'; }).join('')
      : '<li class="empty"><p>No customers match.</p></li>';
  }

  // ---------- customer detail ----------

  function renderCustomer(id) {
    var c = findCustomer(id);
    if (!c) { setBar('Not found', '', '', true); view.innerHTML = '<div class="card empty"><h2>Customer not found</h2><p>They may have been deleted.</p><a class="btn primary" href="#/customers">All customers</a></div>'; return; }
    var s = summaryOf(c);
    var rows = M.runningBalances(entriesOf(id)).reverse();
    setBar(c.name, c.phone || 'No phone number',
      '<button class="icon-btn" data-action="edit-customer" data-id="' + esc(id) + '" aria-label="Edit customer">' + ICONS.edit + '</button>', true);

    var meta = '';
    if (s.balance > 0 && s.dueDate) {
      meta = s.overdue
        ? '<span class="badge overdue">Overdue since ' + esc(M.formatDate(s.dueDate)) + '</span>'
        : '<span class="badge due">Due ' + esc(M.formatDate(s.dueDate)) + '</span>';
    } else if (s.balance === 0 && rows.length) meta = '<span class="badge ok">All clear</span>';

    var html = '<div class="stack">' +
      '<section class="card balance-card">' +
      '<div class="label">' + balanceLabel(s) + '</div>' +
      '<div class="big amount ' + s.status + '">' + esc(money(Math.abs(s.balance))) + '</div>' +
      (meta ? '<div class="meta">' + meta + '</div>' : '') +
      '<div class="actions">' +
      '<button class="action wa" data-action="remind" data-id="' + esc(id) + '">' + ICONS.wa + 'Remind</button>' +
      (c.phone ? '<a class="action" href="tel:' + esc(c.phone.replace(/[^\d+]/g, '')) + '">' + ICONS.phone + 'Call</a>'
        : '<button class="action" data-action="edit-customer" data-id="' + esc(id) + '">' + ICONS.phone + 'Add phone</button>') +
      '<a class="action" href="#/statement/' + encodeURIComponent(id) + '">' + ICONS.doc + 'Statement</a>' +
      '<button class="action" data-action="delete-customer" data-id="' + esc(id) + '">' + ICONS.trash + 'Delete</button>' +
      '</div>' +
      (c.note ? '<div class="note-line">' + esc(c.note) + '</div>' : '') +
      '</section>';

    html += '<section class="card flush">';
    if (rows.length) {
      html += '<div class="entries-head"><span>Entries (' + rows.length + ')</span><span>You gave</span><span>You got</span></div>';
      html += rows.map(function (e) {
        var bal = e.balance > 0 ? 'Bal. ' + money(e.balance) : e.balance < 0 ? 'Advance ' + money(-e.balance) : 'Bal. settled';
        var sub = [];
        if (e.note) sub.push(esc(e.note));
        if (e.type === 'gave' && e.dueDate) sub.push('Due ' + esc(M.formatDate(e.dueDate)));
        return '<button class="entry" data-action="edit-entry" data-id="' + esc(e.id) + '">' +
          '<span><span class="entry-date">' + esc(M.formatDate(e.date)) + '</span>' +
          (sub.length ? '<span class="entry-note">' + sub.join(' · ') + '</span>' : '') +
          '<span class="entry-bal">' + esc(bal) + '</span></span>' +
          '<span class="col gave">' + (e.type === 'gave' ? esc(money(e.amount)) : '') + '</span>' +
          '<span class="col got">' + (e.type === 'got' ? esc(money(e.amount)) : '') + '</span>' +
          '</button>';
      }).join('');
    } else {
      html += '<div class="empty"><div class="art">' + ICONS.book + '</div><h2>No entries yet</h2>' +
        '<p>Tap <b>You gave</b> when you give goods on credit, and <b>You got</b> when they pay you.</p></div>';
    }
    html += '</section></div>';
    html += '<div class="bottom-actions"><div class="btn-row">' +
      '<button class="btn gave" data-action="add-entry" data-type="gave" data-id="' + esc(id) + '">You gave</button>' +
      '<button class="btn got" data-action="add-entry" data-type="got" data-id="' + esc(id) + '">You got</button>' +
      '</div></div>';
    view.innerHTML = html;
  }

  // ---------- statement ----------

  function renderStatement(id) {
    var c = findCustomer(id);
    if (!c) { renderCustomer(id); return; }
    var all = M.runningBalances(entriesOf(id));
    if (ui.stId !== id) { ui.stId = id; ui.stFrom = ''; ui.stTo = ''; }
    var first = all.length ? all[0].date : today();
    var from = ui.stFrom || first;
    var to = ui.stTo || today();
    var opening = 0, gave = 0, got = 0;
    var rows = [];
    all.forEach(function (e) {
      if (e.date < from) opening = e.balance;
      else if (e.date <= to) {
        rows.push(e);
        if (e.type === 'gave') gave += e.amount; else got += e.amount;
      }
    });
    var closing = opening + gave - got;
    setBar('Statement', c.name,
      '<button class="icon-btn" data-action="print" aria-label="Print or save as PDF">' + ICONS.print + '</button>', true);

    var shop = data.settings;
    var html = '<div class="stack">' +
      '<div class="card no-print"><div class="st-controls">' +
      '<label class="field"><span>From</span><input type="date" id="st-from" value="' + esc(from) + '"></label>' +
      '<label class="field"><span>To</span><input type="date" id="st-to" value="' + esc(to) + '"></label></div>' +
      '<button class="btn primary block" data-action="print">' + ICONS.print + 'Print / Save as PDF</button></div>' +
      '<article class="card statement">' +
      '<header class="st-head"><div><p class="st-shop">' + esc(shop.shopName || 'My Shop') + '</p>' +
      (shop.shopPhone ? '<div class="muted small">Phone: ' + esc(shop.shopPhone) + '</div>' : '') + '</div>' +
      '<div style="text-align:right"><div class="st-title">Account statement</div><div class="small muted">Printed ' + esc(M.formatDate(today())) + '</div></div></header>' +
      '<div class="st-meta"><div><b>Customer</b>' + esc(c.name) + (c.phone ? '<br><span class="muted">' + esc(c.phone) + '</span>' : '') + '</div>' +
      '<div><b>Period</b>' + esc(M.formatDate(from)) + ' – ' + esc(M.formatDate(to)) + '</div></div>' +
      '<div class="table-wrap"><table class="st-table"><thead><tr><th>Date</th><th>Details</th><th class="num">You gave</th><th class="num">You got</th><th class="num">Balance</th></tr></thead><tbody>' +
      '<tr class="muted-row"><td>' + esc(M.formatDate(from)) + '</td><td>Opening balance</td><td></td><td></td><td class="num">' + esc(money(opening)) + '</td></tr>' +
      rows.map(function (e) {
        var note = e.note || (e.type === 'gave' ? 'Credit' : 'Payment');
        if (e.type === 'gave' && e.dueDate) note += ' (due ' + M.formatDate(e.dueDate) + ')';
        return '<tr><td>' + esc(M.formatDate(e.date)) + '</td><td>' + esc(note) + '</td>' +
          '<td class="num">' + (e.type === 'gave' ? esc(money(e.amount)) : '') + '</td>' +
          '<td class="num">' + (e.type === 'got' ? esc(money(e.amount)) : '') + '</td>' +
          '<td class="num">' + esc(money(e.balance)) + '</td></tr>';
      }).join('') +
      (rows.length ? '' : '<tr><td colspan="5" class="muted center">No entries in this period.</td></tr>') +
      '</tbody><tfoot><tr><td colspan="2">Total</td><td class="num">' + esc(money(gave)) + '</td><td class="num">' + esc(money(got)) + '</td><td class="num">' + esc(money(closing)) + '</td></tr></tfoot></table></div>' +
      '<div class="st-summary"><span>' + (closing > 0 ? 'Balance due' : closing < 0 ? 'Advance with shop' : 'Settled') + '</span>' +
      '<span class="amount ' + (closing > 0 ? 'owes' : closing < 0 ? 'advance' : 'settled') + '">' + esc(money(Math.abs(closing))) + '</span></div>' +
      '<p class="st-foot">Thank you for your business. — ' + esc(shop.shopName || '') + '</p>' +
      '</article></div>';
    view.innerHTML = html;
  }

  // ---------- settings ----------

  function renderSettings() {
    setBar('Settings', 'Shop details and your data');
    var s = data.settings;
    var html = '<div class="stack">' +
      '<section class="card"><h2 class="card-title">Shop</h2>' +
      '<label class="field"><span>Shop name</span><input id="set-shopName" maxlength="80" value="' + esc(s.shopName) + '" autocomplete="organization"></label>' +
      '<label class="field"><span>Shop phone</span><input id="set-shopPhone" type="tel" maxlength="30" value="' + esc(s.shopPhone) + '" autocomplete="tel"></label>' +
      '<div class="field-row">' +
      '<label class="field"><span>Currency</span><input id="set-currency" maxlength="6" value="' + esc(s.currency) + '"></label>' +
      '<label class="field"><span>Country code</span><input id="set-countryCode" inputmode="numeric" maxlength="4" value="' + esc(s.countryCode) + '"><span class="hint">Used for WhatsApp, e.g. 92</span></label>' +
      '</div>' +
      '<label class="field" style="margin-bottom:0"><span>Theme</span><select id="set-theme">' +
      '<option value="system">Same as phone</option><option value="light">Light</option><option value="dark">Dark</option></select></label>' +
      '</section>' +

      '<section class="card"><h2 class="card-title">WhatsApp reminder</h2>' +
      '<label class="field"><span>Message template</span><textarea id="set-template" rows="5" maxlength="1500">' + esc(s.template) + '</textarea></label>' +
      '<div class="placeholders" aria-label="Placeholders (tap to insert)">' +
      ['{name}', '{shop}', '{balance}', '{due}', '{duedate}', '{shopphone}'].map(function (p) {
        return '<code role="button" tabindex="0" data-insert="' + p + '">' + p + '</code>';
      }).join('') + '</div>' +
      '<p class="small muted" style="margin-top:0">{due} becomes “, due on 5 Nov 2026” (or nothing if no due date). Preview:</p>' +
      '<div class="preview" id="tpl-preview"></div>' +
      '<button class="btn ghost block" data-action="reset-template" style="margin-top:8px">Restore default message</button>' +
      '</section>' +

      '<section class="card"><h2 class="card-title">Security</h2>' +
      '<div class="setting-row"><div><div style="font-weight:650">PIN lock</div><div class="small muted">' +
      (s.pinHash ? 'On — the app asks for your 4-digit PIN' : 'Off — anyone with your phone can open the app') + '</div></div>' +
      (s.pinHash
        ? '<div class="btn-row"><button class="btn" data-action="set-pin">Change</button><button class="btn danger" data-action="remove-pin">Remove</button></div>'
        : '<button class="btn primary" data-action="set-pin">Set PIN</button>') +
      '</div></section>' +

      '<section class="card"><h2 class="card-title">My data</h2>' +
      '<p class="small muted" style="margin-top:0">Your data is saved only on this device (' + data.customers.length + ' customers, ' + data.entries.length + ' entries). Take a backup regularly and keep it safe, e.g. on Google Drive or WhatsApp.</p>' +
      '<div class="data-grid">' +
      '<button class="btn primary" data-action="backup">Backup (JSON)</button>' +
      '<button class="btn" data-action="restore">Restore backup</button>' +
      '<button class="btn" data-action="csv">Export CSV (Excel)</button>' +
      '<button class="btn" data-action="demo">Load demo data</button>' +
      '</div>' +
      '<input type="file" id="restore-file" accept="application/json,.json" hidden>' +
      '<button class="btn danger block" data-action="reset" style="margin-top:12px">' + ICONS.trash + 'Reset — delete all data</button>' +
      '</section>' +
      '<p class="center small muted">Udhaar Khata · works offline · no account needed</p>' +
      '</div>';
    view.innerHTML = html;
    $('#set-theme').value = s.theme;
    updatePreview();
  }

  function reminderMessage(c, s, tpl) {
    var due = s.balance > 0 && s.dueDate ? M.formatDate(s.dueDate) : '';
    return M.fillTemplate(tpl || data.settings.template, {
      name: c.name,
      shop: data.settings.shopName || 'our shop',
      balance: money(Math.max(0, s.balance)),
      due: due ? ', due on ' + due : '',
      duedate: due || 'as soon as possible',
      shopphone: data.settings.shopPhone || ''
    });
  }

  function updatePreview() {
    var el = $('#tpl-preview');
    if (!el) return;
    var sample = { id: 'x', name: 'Ahmed Raza', phone: '' };
    el.textContent = reminderMessage(sample, { balance: 1250000, dueDate: M.addDays(today(), 7) }, $('#set-template').value);
  }

  function saveSetting(key, value) {
    if (key === 'currency') value = value.trim().slice(0, 6);
    if (key === 'countryCode') value = value.replace(/\D/g, '').slice(0, 4);
    if (key === 'shopName') value = value.slice(0, 80);
    data.settings[key] = value;
    persist();
    if (key === 'theme') applyTheme();
  }

  // ---------- sheets & dialogs ----------

  var openSheets = [];

  function openSheet(html, opts) {
    opts = opts || {};
    var lastFocus = document.activeElement;
    var backdrop = document.createElement('div');
    backdrop.className = 'backdrop' + (opts.dialog ? ' dialog' : '');
    backdrop.innerHTML = '<div class="sheet" role="dialog" aria-modal="true">' + html + '</div>';
    sheetRoot.appendChild(backdrop);
    document.body.classList.add('sheet-open');
    var sheet = backdrop.firstChild;
    var handle = {
      el: sheet,
      close: function (result) {
        if (handle.closed) return;
        handle.closed = true;
        backdrop.remove();
        openSheets.splice(openSheets.indexOf(handle), 1);
        if (!openSheets.length) document.body.classList.remove('sheet-open');
        if (lastFocus && lastFocus.focus) lastFocus.focus();
        if (opts.onClose) opts.onClose(result);
      }
    };
    openSheets.push(handle);
    backdrop.addEventListener('click', function (ev) { if (ev.target === backdrop) handle.close(); });
    sheet.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-close]')) handle.close();
    });
    var focusEl = sheet.querySelector('[autofocus]') || sheet.querySelector('input, textarea, select, button');
    if (focusEl) setTimeout(function () { if (!sheet.contains(document.activeElement)) focusEl.focus(); }, 30);
    return handle;
  }

  function confirmDialog(o) {
    return new Promise(function (resolve) {
      var h = openSheet(
        '<h2>' + esc(o.title) + '</h2><p>' + esc(o.message) + '</p>' +
        (o.typeToConfirm ? '<label class="field"><span>Type ' + esc(o.typeToConfirm) + ' to confirm</span><input id="cf-type" autocomplete="off" autocapitalize="characters"></label>' : '') +
        '<div class="btn-row"><button class="btn" data-close>Cancel</button>' +
        '<button class="btn ' + (o.danger ? 'danger solid' : 'primary') + '" id="cf-ok"' + (o.typeToConfirm ? ' disabled' : '') + '>' + esc(o.confirmText || 'OK') + '</button></div>',
        { dialog: true, onClose: function (r) { resolve(r === true); } }
      );
      var ok = $('#cf-ok', h.el);
      if (o.typeToConfirm) {
        $('#cf-type', h.el).addEventListener('input', function (ev) {
          ok.disabled = ev.target.value.trim().toUpperCase() !== o.typeToConfirm;
        });
      } else {
        setTimeout(function () { if (!h.el.contains(document.activeElement) || document.activeElement.tagName === 'BUTTON') ok.focus(); }, 40);
      }
      ok.addEventListener('click', function () { h.close(true); });
    });
  }

  function customerForm(c) {
    var editing = !!c;
    c = c || { name: '', phone: '', note: '' };
    var h = openSheet(
      '<h2>' + (editing ? 'Edit customer' : 'New customer') + '</h2>' +
      '<form id="cust-form" novalidate>' +
      '<label class="field"><span>Name *</span><input name="name" maxlength="100" required autofocus autocomplete="off" value="' + esc(c.name) + '"><span class="error" id="name-err" hidden>Please enter a name.</span></label>' +
      '<label class="field"><span>Phone</span><input name="phone" type="tel" maxlength="30" placeholder="0300-1234567" autocomplete="off" value="' + esc(c.phone) + '"><span class="hint">Needed for WhatsApp reminders and calls.</span></label>' +
      '<label class="field"><span>Note</span><textarea name="note" rows="2" maxlength="300" placeholder="Address, landmark, anything useful">' + esc(c.note) + '</textarea></label>' +
      '<div class="btn-row"><button type="button" class="btn" data-close>Cancel</button><button type="submit" class="btn primary">' + (editing ? 'Save' : 'Add customer') + '</button></div>' +
      '</form>'
    );
    $('#cust-form', h.el).addEventListener('submit', function (ev) {
      ev.preventDefault();
      var f = ev.target;
      var nameInput = f.elements['name'];
      var name = nameInput.value.trim();
      if (!name) { $('#name-err', h.el).hidden = false; nameInput.focus(); return; }
      var now = Date.now();
      if (editing) {
        c.name = name;
        c.phone = f.phone.value.trim();
        c.note = f.note.value.trim();
        c.updatedAt = now;
        persist();
        h.close();
        toast('Customer updated');
        render();
      } else {
        var nc = { id: S.uid(), name: name, phone: f.phone.value.trim(), note: f.note.value.trim(), createdAt: now, updatedAt: now };
        data.customers.push(nc);
        persist();
        h.close();
        toast('Customer added');
        go('#/customer/' + encodeURIComponent(nc.id));
      }
    });
  }

  function entryForm(customerId, type, entry) {
    var c = findCustomer(customerId);
    var editing = !!entry;
    var e = entry || { type: type, amount: 0, date: today(), dueDate: '', note: '' };
    var cur = esc(data.settings.currency);
    var h = openSheet(
      '<h2>' + (editing ? 'Edit entry' : (e.type === 'gave' ? 'You gave' : 'You got')) + ' · ' + esc(c.name) + '</h2>' +
      '<form id="entry-form" novalidate>' +
      '<div class="segmented" role="group" aria-label="Entry type">' +
      '<button type="button" class="gave" data-type="gave" aria-pressed="' + (e.type === 'gave') + '">You gave (credit)</button>' +
      '<button type="button" class="got" data-type="got" aria-pressed="' + (e.type === 'got') + '">You got (payment)</button></div>' +
      '<label class="field"><span>Amount (' + cur + ') *</span><input name="amount" class="amount-input" inputmode="decimal" autocomplete="off" placeholder="0" autofocus value="' + (e.amount ? esc(M.toInputValue(e.amount)) : '') + '">' +
      '<span class="error" id="amt-err" hidden>Enter an amount greater than 0.</span></label>' +
      '<div class="quick" role="group" aria-label="Quick amounts" style="margin:-6px 0 14px">' +
      [100, 500, 1000, 5000].map(function (n) {
        return '<button type="button" class="chip" data-quick="' + n + '" aria-label="Add ' + esc(money(n * 100)) + '">+' + esc(M.formatMoney(n * 100, '')) + '</button>';
      }).join('') +
      '<button type="button" class="chip" data-quick="0">Clear</button></div>' +
      '<div class="field-row"><label class="field"><span>Date</span><input name="date" type="date" required value="' + esc(e.date) + '" max="' + esc(M.addDays(today(), 365)) + '"></label>' +
      '<label class="field" id="due-field"><span>Due date (optional)</span><input name="dueDate" type="date" value="' + esc(e.dueDate) + '"></label></div>' +
      '<div class="quick" id="due-quick" style="margin:-6px 0 14px">' +
      [7, 15, 30].map(function (n) { return '<button type="button" class="chip" data-due="' + n + '">Due in ' + n + ' days</button>'; }).join('') +
      '<button type="button" class="chip" data-due="0">No due date</button></div>' +
      '<label class="field"><span>Note</span><input name="note" maxlength="300" autocomplete="off" placeholder="Items, payment method…" value="' + esc(e.note) + '"></label>' +
      '<div class="btn-row">' +
      (editing ? '<button type="button" class="btn danger" id="del-entry">' + ICONS.trash + 'Delete</button>' : '<button type="button" class="btn" data-close>Cancel</button>') +
      '<button type="submit" class="btn ' + e.type + '" id="save-entry">Save</button></div>' +
      '</form>'
    );
    var form = $('#entry-form', h.el);
    var curType = e.type;
    function syncType() {
      $all('.segmented button', h.el).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-type') === curType)); });
      $('#due-field', h.el).hidden = curType !== 'gave';
      $('#due-quick', h.el).hidden = curType !== 'gave';
      $('#save-entry', h.el).className = 'btn ' + curType;
    }
    syncType();
    $all('.segmented button', h.el).forEach(function (b) {
      b.addEventListener('click', function () { curType = b.getAttribute('data-type'); syncType(); });
    });
    // Quick amounts add up, so 500 + 100 can be tapped as two buttons.
    $all('[data-quick]', h.el).forEach(function (b) {
      b.addEventListener('click', function (ev) {
        ev.preventDefault();
        var n = +b.getAttribute('data-quick') * 100;
        var current = M.parseAmount(form.amount.value) || 0;
        form.amount.value = n ? M.toInputValue(current + n) : '';
        $('#amt-err', h.el).hidden = true;
      });
    });
    $all('[data-due]', h.el).forEach(function (b) {
      b.addEventListener('click', function () {
        var n = +b.getAttribute('data-due');
        form.dueDate.value = n ? M.addDays(form.date.value || today(), n) : '';
      });
    });
    if (editing) {
      $('#del-entry', h.el).addEventListener('click', function () {
        confirmDialog({ title: 'Delete this entry?', message: money(entry.amount) + ' on ' + M.formatDate(entry.date) + ' will be removed and the balance recalculated.', confirmText: 'Delete', danger: true })
          .then(function (yes) {
            if (!yes) return;
            data.entries = data.entries.filter(function (x) { return x.id !== entry.id; });
            persist();
            h.close();
            toast('Entry deleted');
            render();
          });
      });
    }
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var amount = M.parseAmount(form.amount.value);
      if (!amount) { $('#amt-err', h.el).hidden = false; form.amount.focus(); return; }
      var date = M.isValidDate(form.date.value) ? form.date.value : today();
      var due = curType === 'gave' && M.isValidDate(form.dueDate.value) ? form.dueDate.value : '';
      var note = form.note.value.trim();
      if (editing) {
        entry.type = curType; entry.amount = amount; entry.date = date; entry.dueDate = due; entry.note = note;
      } else {
        data.entries.push({ id: S.uid(), customerId: customerId, type: curType, amount: amount, date: date, dueDate: due, note: note, createdAt: Date.now() });
      }
      persist();
      h.close();
      toast(editing ? 'Entry updated' : (curType === 'gave' ? 'Credit of ' : 'Payment of ') + money(amount) + ' saved');
      render();
    });
  }

  // ---------- PIN ----------

  function hashPin(pin) {
    var salted = 'udhaarkhata:' + pin;
    if (window.crypto && crypto.subtle && window.TextEncoder) {
      return crypto.subtle.digest('SHA-256', new TextEncoder().encode(salted)).then(function (buf) {
        return 'sha256:' + Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
      });
    }
    // Fallback for insecure contexts (e.g. opened from file://).
    var h = 2166136261;
    for (var i = 0; i < salted.length; i++) { h ^= salted.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return Promise.resolve('fnv:' + h.toString(16));
  }

  function keypadHtml() {
    var keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
    return '<div class="keypad">' + keys.map(function (k) { return '<button type="button" data-key="' + k + '">' + k + '</button>'; }).join('') +
      '<span></span><button type="button" data-key="0">0</button>' +
      '<button type="button" class="plain" data-key="del" aria-label="Delete digit">' + ICONS.del + '</button></div>';
  }

  // Shows a PIN pad inside `container`; calls onComplete(pin, reset) after 4 digits.
  function pinPad(container, title, subtitle, onComplete, extraHtml) {
    var pin = '';
    container.innerHTML =
      '<img class="logo" src="./icons/icon-192.png" alt="">' +
      '<h2 class="pin-title">' + esc(title) + '</h2><p class="pin-sub">' + esc(subtitle) + '</p>' +
      '<div class="pin-dots" aria-hidden="true"><i></i><i></i><i></i><i></i></div>' +
      keypadHtml() + (extraHtml || '');
    var dots = $all('.pin-dots i', container);
    function paint() { dots.forEach(function (d, i) { d.classList.toggle('on', i < pin.length); }); }
    function reset(msg) {
      pin = '';
      paint();
      if (msg) {
        $('.pin-sub', container).textContent = msg;
        var pd = $('.pin-dots', container);
        pd.classList.remove('shake'); void pd.offsetWidth; pd.classList.add('shake');
      }
    }
    function press(k) {
      if (k === 'del') pin = pin.slice(0, -1);
      else if (pin.length < 4) pin += k;
      paint();
      if (pin.length === 4) { var p = pin; setTimeout(function () { onComplete(p, reset); }, 120); }
    }
    container.onclick = function (ev) {
      var b = ev.target.closest('[data-key]');
      if (b) press(b.getAttribute('data-key'));
    };
    container._keyHandler = function (ev) {
      if (/^\d$/.test(ev.key)) press(ev.key);
      else if (ev.key === 'Backspace') press('del');
      else return false;
      return true;
    };
    return { reset: reset };
  }

  var lockEl = document.getElementById('lock');
  var hiddenAt = 0;

  function showLock() {
    if (!data.settings.pinHash) return;
    while (openSheets.length) openSheets[openSheets.length - 1].close();
    lockEl.hidden = false;
    document.body.classList.add('sheet-open');
    pinPad(lockEl, data.settings.shopName || 'Udhaar Khata', 'Enter your 4-digit PIN', function (pin, reset) {
      hashPin(pin).then(function (h) {
        if (h === data.settings.pinHash) {
          lockEl.hidden = true;
          lockEl.innerHTML = '';
          if (!openSheets.length) document.body.classList.remove('sheet-open');
        } else reset('Wrong PIN, try again');
      });
    }, '<button class="link" type="button" id="forgot-pin">Forgot PIN?</button>');
    $('#forgot-pin', lockEl).addEventListener('click', function () {
      confirmDialog({
        title: 'Forgot your PIN?',
        message: 'The PIN cannot be recovered. The only way in is to erase ALL data on this device. You can restore a backup afterwards.',
        confirmText: 'Erase everything', danger: true, typeToConfirm: 'ERASE'
      }).then(function (yes) {
        if (!yes) return;
        data = S.emptyData();
        persist();
        lockEl.hidden = true;
        lockEl.innerHTML = '';
        document.body.classList.remove('sheet-open');
        applyTheme();
        go('#/');
        toast('All data erased');
      });
    });
  }

  function setPinFlow() {
    var h = openSheet('<div class="lock" style="position:static;border-radius:16px;padding:24px 8px" id="pin-setup"></div><button class="btn block" style="margin-top:12px" data-close>Cancel</button>');
    var box = $('#pin-setup', h.el);
    var first = '';
    pinPad(box, 'Set a PIN', 'Choose 4 digits you will remember', function step(pin, reset) {
      if (!first) {
        first = pin;
        $('.pin-title', box).textContent = 'Confirm PIN';
        $('.pin-sub', box).textContent = 'Enter the same 4 digits again';
        reset();
      } else if (pin !== first) {
        first = '';
        $('.pin-title', box).textContent = 'Set a PIN';
        reset('PINs did not match — start again');
      } else {
        hashPin(pin).then(function (hash) {
          data.settings.pinHash = hash;
          persist();
          h.close();
          toast('PIN lock is on');
          render();
        });
      }
    });
    activePad = box;
  }

  var activePad = null;
  document.addEventListener('keydown', function (ev) {
    if (!lockEl.hidden && lockEl._keyHandler && !openSheets.length) { lockEl._keyHandler(ev); return; }
    if (activePad && document.body.contains(activePad) && openSheets.length === 1 && activePad._keyHandler(ev)) return;
    if (ev.key === 'Escape' && openSheets.length) openSheets[openSheets.length - 1].close();
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) hiddenAt = Date.now();
    else if (data.settings.pinHash && hiddenAt && Date.now() - hiddenAt > 60000 && lockEl.hidden) showLock();
  });

  // ---------- actions ----------

  function remind(id) {
    var c = findCustomer(id);
    var s = summaryOf(c);
    if (s.balance <= 0) { toast('Nothing to remind — ' + c.name + ' owes you nothing.'); return; }
    var msg = reminderMessage(c, s);
    var phone = M.waPhone(c.phone, data.settings.countryCode);
    var url = 'https://wa.me/' + phone + '?text=' + encodeURIComponent(msg);
    window.open(url, '_blank', 'noopener');
  }

  function loadDemo() {
    var apply = function () {
      var keep = data.settings;
      data = S.demoData(today(), keep);
      persist();
      toast('Demo data loaded');
      go('#/');
    };
    if (!data.customers.length) return apply();
    confirmDialog({ title: 'Load demo data?', message: 'This replaces your current ' + data.customers.length + ' customers and ' + data.entries.length + ' entries. Take a backup first if you need them.', confirmText: 'Replace with demo', danger: true })
      .then(function (yes) { if (yes) apply(); });
  }

  function backup() {
    var copy = JSON.parse(JSON.stringify(data));
    copy.settings.pinHash = '';
    copy.exportedAt = new Date().toISOString();
    download('udhaar-khata-backup-' + today() + '.json', S.serialize(copy), 'application/json');
    toast('Backup downloaded');
  }

  function restoreFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var res = S.parseBackup(String(reader.result));
      if (!res.ok) { toast(res.error); return; }
      var d = res.data;
      confirmDialog({
        title: 'Restore this backup?',
        message: 'It has ' + d.customers.length + ' customers and ' + d.entries.length + ' entries. Your current data on this device will be replaced.',
        confirmText: 'Restore', danger: true
      }).then(function (yes) {
        if (!yes) return;
        d.settings.pinHash = data.settings.pinHash;
        data = d;
        persist();
        applyTheme();
        toast('Backup restored');
        go('#/');
      });
    };
    reader.onerror = function () { toast('Could not read the file.'); };
    reader.readAsText(file);
  }

  view.addEventListener('click', function (ev) {
    var fl = ev.target.closest('[data-filter-link]');
    if (fl) { ui.filter = fl.getAttribute('data-filter-link'); ui.query = ''; navigatedInApp = true; return; }
    var chip = ev.target.closest('[data-filter]');
    if (chip) { ui.filter = chip.getAttribute('data-filter'); $all('[data-filter]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === chip)); }); renderCustomerList(); return; }
    var ins = ev.target.closest('[data-insert]');
    if (ins) { insertPlaceholder(ins.getAttribute('data-insert')); return; }
    if (ev.target.closest('a[href^="#/"]')) navigatedInApp = true;
  });

  view.addEventListener('keydown', function (ev) {
    var ins = ev.target.closest('[data-insert]');
    if (ins && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); insertPlaceholder(ins.getAttribute('data-insert')); }
  });

  function insertPlaceholder(p) {
    var ta = $('#set-template');
    var start = ta.selectionStart || ta.value.length, end = ta.selectionEnd || ta.value.length;
    ta.value = ta.value.slice(0, start) + p + ta.value.slice(end);
    ta.focus();
    ta.selectionStart = ta.selectionEnd = start + p.length;
    saveSetting('template', ta.value);
    updatePreview();
  }

  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-action]');
    if (!b || b.closest('.sheet')) return;
    var id = b.getAttribute('data-id');
    switch (b.getAttribute('data-action')) {
      case 'add-customer': customerForm(); break;
      case 'edit-customer': customerForm(findCustomer(id)); break;
      case 'delete-customer': {
        var c = findCustomer(id);
        var n = entriesOf(id).length;
        confirmDialog({ title: 'Delete ' + c.name + '?', message: 'This customer and all ' + n + ' entr' + (n === 1 ? 'y' : 'ies') + ' will be permanently deleted.', confirmText: 'Delete', danger: true })
          .then(function (yes) {
            if (!yes) return;
            data.customers = data.customers.filter(function (x) { return x.id !== id; });
            data.entries = data.entries.filter(function (x) { return x.customerId !== id; });
            persist();
            toast('Customer deleted');
            go('#/customers');
          });
        break;
      }
      case 'add-entry': entryForm(id, b.getAttribute('data-type')); break;
      case 'edit-entry': {
        var entry = data.entries.filter(function (x) { return x.id === id; })[0];
        if (entry) entryForm(entry.customerId, entry.type, entry);
        break;
      }
      case 'remind': remind(id); break;
      case 'print': window.print(); break;
      case 'demo': loadDemo(); break;
      case 'backup': backup(); break;
      case 'restore': $('#restore-file').click(); break;
      case 'csv':
        download('udhaar-khata-' + today() + '.csv', '﻿' + S.toCSV(data), 'text/csv;charset=utf-8');
        toast('CSV exported');
        break;
      case 'reset':
        confirmDialog({ title: 'Delete all data?', message: 'All customers, entries and settings on this device will be erased. This cannot be undone.', confirmText: 'Delete everything', danger: true, typeToConfirm: 'RESET' })
          .then(function (yes) {
            if (!yes) return;
            data = S.emptyData();
            persist();
            applyTheme();
            toast('All data deleted');
            go('#/');
          });
        break;
      case 'reset-template':
        data.settings.template = S.DEFAULT_TEMPLATE;
        persist();
        $('#set-template').value = S.DEFAULT_TEMPLATE;
        updatePreview();
        toast('Default message restored');
        break;
      case 'set-pin': setPinFlow(); break;
      case 'remove-pin':
        confirmDialog({ title: 'Remove PIN lock?', message: 'Anyone with your phone will be able to open the app.', confirmText: 'Remove PIN', danger: true })
          .then(function (yes) {
            if (!yes) return;
            data.settings.pinHash = '';
            persist();
            toast('PIN removed');
            render();
          });
        break;
    }
  });

  view.addEventListener('input', function (ev) {
    var t = ev.target;
    if (t.id === 'search') { ui.query = t.value; renderCustomerList(); return; }
    if (t.id === 'set-template') { saveSetting('template', t.value); updatePreview(); return; }
    if (t.id && t.id.indexOf('set-') === 0 && t.tagName !== 'SELECT') { saveSetting(t.id.slice(4), t.value); updatePreview(); }
  });

  view.addEventListener('change', function (ev) {
    var t = ev.target;
    if (t.id === 'sort') { ui.sort = t.value; renderCustomerList(); }
    else if (t.id === 'set-theme') { saveSetting('theme', t.value); toast('Theme updated'); }
    else if (t.id === 'restore-file' && t.files[0]) { restoreFile(t.files[0]); t.value = ''; }
    else if (t.id === 'st-from' || t.id === 'st-to') {
      if (M.isValidDate(t.value)) { ui[t.id === 'st-from' ? 'stFrom' : 'stTo'] = t.value; render(); }
    } else if (t.id && t.id.indexOf('set-') === 0) toast('Saved');
  });

  document.getElementById('back-btn').addEventListener('click', function () {
    var r = parseRoute();
    if (navigatedInApp && history.length > 1) history.back();
    else go(r.name === 'statement' && r.id ? '#/customer/' + encodeURIComponent(r.id) : '#/customers');
  });

  window.addEventListener('hashchange', function () {
    while (openSheets.length) openSheets[openSheets.length - 1].close();
    render();
    window.scrollTo(0, 0);
  });

  // Keep data in sync if the app is open in two tabs.
  window.addEventListener('storage', function (ev) {
    if (ev.key === S.KEY) { data = S.load(localStorage); applyTheme(); render(); }
  });

  // ---------- boot ----------

  applyTheme();
  render();
  showLock();

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function () { /* offline support unavailable */ });
    });
  }
})();
