'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../js/money.js');
const S = require('../js/store.js');

const TODAY = '2026-10-24';
let seq = 0;
function entry(customerId, type, rs, date, extra) {
  seq++;
  return Object.assign({ id: 'e' + seq, customerId, type, amount: Math.round(rs * 100), date, dueDate: '', note: '', createdAt: seq }, extra);
}
const cust = (id, name) => ({ id, name, phone: '', note: '', createdAt: 1 });

test('running balance after every entry (gave adds, got subtracts)', () => {
  const rows = M.runningBalances([
    entry('a', 'gave', 1000, '2026-10-01'),
    entry('a', 'got', 400, '2026-10-02'),
    entry('a', 'gave', 250.5, '2026-10-03'),
    entry('a', 'got', 1000, '2026-10-04')
  ]);
  assert.deepEqual(rows.map((r) => r.balance), [100000, 60000, 85050, -14950]);
});

test('running balance is chronological regardless of input order', () => {
  const late = entry('a', 'got', 300, '2026-10-05');
  const early = entry('a', 'gave', 500, '2026-10-01');
  const rows = M.runningBalances([late, early]);
  assert.deepEqual(rows.map((r) => r.id), [early.id, late.id]);
  assert.deepEqual(rows.map((r) => r.balance), [50000, 20000]);
});

test('same-day entries keep the order they were created in', () => {
  const first = entry('a', 'gave', 100, '2026-10-01', { createdAt: 10 });
  const second = entry('a', 'got', 100, '2026-10-01', { createdAt: 20 });
  const rows = M.runningBalances([second, first]);
  assert.deepEqual(rows.map((r) => r.balance), [10000, 0]);
});

test('runningBalances does not mutate the input entries', () => {
  const e = entry('a', 'gave', 100, '2026-10-01');
  M.runningBalances([e]);
  assert.equal('balance' in e, false);
});

test('customerBalance handles empty list, edits and deletes', () => {
  assert.equal(M.customerBalance([]), 0);
  const list = [entry('a', 'gave', 2000, '2026-10-01'), entry('a', 'got', 500, '2026-10-02')];
  assert.equal(M.customerBalance(list), 150000);
  list[1].amount = 200000; // edit payment to Rs 2,000
  assert.equal(M.customerBalance(list), 0);
  assert.equal(M.customerBalance(list.slice(0, 1)), 200000); // delete payment
});

test('no floating point drift on many small decimal amounts', () => {
  const list = [];
  for (let i = 0; i < 1000; i++) list.push(entry('a', 'gave', 0.1, '2026-10-01'));
  assert.equal(M.customerBalance(list), 10000);
  assert.equal(M.formatMoney(M.customerBalance(list)), 'Rs 100');
});

test('open due date applies payments to the oldest credit first', () => {
  const list = [
    entry('a', 'gave', 1000, '2026-09-01', { dueDate: '2026-09-15' }),
    entry('a', 'gave', 500, '2026-10-01', { dueDate: '2026-10-30' }),
    entry('a', 'got', 1000, '2026-10-05')
  ];
  assert.equal(M.openDueDate(list), '2026-10-30');
  list[2].amount = 50000; // only half of the first credit paid
  assert.equal(M.openDueDate(list), '2026-09-15');
});

test('summarize: overdue, due soon, settled and advance', () => {
  const customers = [cust('a', 'Ahmed'), cust('b', 'Bilal'), cust('c', 'Chand'), cust('d', 'Dua'), cust('e', 'Esa')];
  const entries = [
    entry('a', 'gave', 1000, '2026-10-01', { dueDate: '2026-10-10' }), // overdue
    entry('b', 'gave', 1000, '2026-10-20', { dueDate: '2026-11-01' }), // not yet due
    entry('c', 'gave', 500, '2026-10-01', { dueDate: '2026-10-05' }),
    entry('c', 'got', 500, '2026-10-06'), // settled — past due no longer matters
    entry('d', 'got', 300, '2026-10-06'), // advance
    entry('a', 'gave', 100, '2026-10-24', { dueDate: TODAY }) // due today is not overdue on its own
  ];
  const by = Object.fromEntries(M.summarize(customers, entries, TODAY).map((s) => [s.customer.id, s]));
  assert.equal(by.a.overdue, true);
  assert.equal(by.a.daysOverdue, 14);
  assert.equal(by.a.balance, 110000);
  assert.equal(by.b.overdue, false);
  assert.equal(by.b.dueDate, '2026-11-01');
  assert.equal(by.c.status, 'settled');
  assert.equal(by.c.overdue, false);
  assert.equal(by.c.dueDate, '');
  assert.equal(by.d.status, 'advance');
  assert.equal(by.d.balance, -30000);
  assert.equal(by.e.entryCount, 0);
  assert.equal(by.e.status, 'settled');
});

test('filterSummaries: filters, search and sorting', () => {
  const customers = [cust('a', 'Ahmed Raza'), cust('b', 'Bilal'), cust('c', 'Chand'), Object.assign(cust('d', 'Dua'), { phone: '0300-1234567' })];
  const entries = [
    entry('a', 'gave', 500, '2026-10-01', { dueDate: '2026-10-05' }),
    entry('b', 'gave', 2000, '2026-10-20'),
    entry('d', 'got', 100, '2026-10-21')
  ];
  const all = M.summarize(customers, entries, TODAY);
  const ids = (list) => list.map((s) => s.customer.id);
  assert.deepEqual(ids(M.filterSummaries(all, { filter: 'all' })), ['b', 'a', 'c', 'd']);
  assert.deepEqual(ids(M.filterSummaries(all, { filter: 'owes' })), ['b', 'a']);
  assert.deepEqual(ids(M.filterSummaries(all, { filter: 'overdue' })), ['a']);
  assert.deepEqual(ids(M.filterSummaries(all, { filter: 'settled' })), ['c', 'd']);
  assert.deepEqual(ids(M.filterSummaries(all, { query: 'raza' })), ['a']);
  assert.deepEqual(ids(M.filterSummaries(all, { query: '1234567' })), ['d']);
  assert.deepEqual(ids(M.filterSummaries(all, { sort: 'name' })), ['a', 'b', 'c', 'd']);
  assert.deepEqual(ids(M.filterSummaries(all, { sort: 'recent' })).slice(0, 2), ['d', 'b']);
});

test('dashboardStats: totals, month boundaries, top 5 and overdue', () => {
  const customers = 'abcdefg'.split('').map((id) => cust(id, id.toUpperCase()));
  const entries = [
    entry('a', 'gave', 700, '2026-09-10', { dueDate: '2026-09-20' }),
    entry('a', 'got', 100, '2026-09-30'), // last month — not counted
    entry('a', 'got', 100, '2026-10-01'), // this month
    entry('b', 'gave', 600, '2026-10-02'),
    entry('c', 'gave', 500, '2026-10-03'),
    entry('d', 'gave', 400, '2026-10-04'),
    entry('e', 'gave', 300, '2026-10-05'),
    entry('f', 'gave', 200, '2026-10-06'),
    entry('g', 'got', 50, '2026-10-24'), // advance, not part of total to collect
    entry('ghost', 'gave', 9999, '2026-10-10') // orphan entry is ignored
  ];
  const st = M.dashboardStats(customers, entries, TODAY);
  assert.equal(st.totalToCollect, (500 + 600 + 500 + 400 + 300 + 200) * 100);
  assert.equal(st.customersWithDues, 6);
  assert.equal(st.collectedThisMonth, 15000);
  assert.equal(st.givenThisMonth, 200000);
  assert.deepEqual(st.topDebtors.map((s) => s.customer.id), ['b', 'a', 'c', 'd', 'e']);
  assert.deepEqual(st.overdue.map((s) => s.customer.id), ['a']);
  assert.equal(st.series.length, 30);
  assert.equal(st.series.reduce((n, d) => n + d.gave, 0), 200000);
});

test('dailySeries: 30 buckets ending today, out-of-range entries ignored', () => {
  const s = M.dailySeries([
    entry('a', 'gave', 100, TODAY),
    entry('a', 'got', 40, TODAY),
    entry('a', 'gave', 5, '2026-09-25'), // first bucket
    entry('a', 'gave', 999, '2026-09-24'), // 31 days ago
    entry('a', 'gave', 999, '2026-10-25') // future
  ], TODAY, 30);
  assert.equal(s.length, 30);
  assert.equal(s[0].date, '2026-09-25');
  assert.equal(s[29].date, TODAY);
  assert.deepEqual(s[29], { date: TODAY, gave: 10000, got: 4000 });
  assert.equal(s[0].gave, 500);
  assert.equal(s.reduce((n, d) => n + d.gave, 0), 10500);
});

test('dates: month and year rollovers', () => {
  assert.equal(M.addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(M.addDays('2028-03-01', -1), '2028-02-29');
  assert.equal(M.daysBetween('2026-10-01', '2026-10-24'), 23);
  assert.equal(M.isValidDate('2026-02-30'), false);
  assert.equal(M.isValidDate('hello'), false);
});

test('formatMoney uses Rs and thousands separators', () => {
  assert.equal(M.formatMoney(1250000), 'Rs 12,500');
  assert.equal(M.formatMoney(0), 'Rs 0');
  assert.equal(M.formatMoney(1250050), 'Rs 12,500.50');
  assert.equal(M.formatMoney(-50000), '-Rs 500');
  assert.equal(M.formatMoney(123456789000), 'Rs 1,234,567,890');
  assert.equal(M.formatMoney(99, 'PKR'), 'PKR 0.99');
  assert.equal(M.formatMoney(100000, ''), '1,000');
});

test('formatCompact for chart axes', () => {
  assert.equal(M.formatCompact(0), '0');
  assert.equal(M.formatCompact(150000), '1.5k');
  assert.equal(M.formatCompact(25000000), '2.5L');
});

test('parseAmount accepts commas and 2 decimals, rejects junk', () => {
  assert.equal(M.parseAmount('12,500'), 1250000);
  assert.equal(M.parseAmount(' 99.5 '), 9950);
  assert.equal(M.parseAmount('0.05'), 5);
  assert.equal(M.parseAmount(250), 25000);
  for (const bad of ['', '0', '-5', 'abc', '1.234', '1e5', '12..5', null, undefined]) {
    assert.equal(M.parseAmount(bad), null, 'should reject ' + bad);
  }
  assert.equal(M.toInputValue(1250050), '12500.5');
  assert.equal(M.toInputValue(M.parseAmount('7.05')), '7.05');
});

test('fillTemplate replaces known placeholders only', () => {
  const out = M.fillTemplate('Hi {name}, pay {balance}{due}. {unknown}', { name: 'Ali', balance: 'Rs 500', due: '' });
  assert.equal(out, 'Hi Ali, pay Rs 500. {unknown}');
});

test('waPhone normalises local numbers for wa.me', () => {
  assert.equal(M.waPhone('0300-1234567', '92'), '923001234567');
  assert.equal(M.waPhone('+92 300 1234567', '92'), '923001234567');
  assert.equal(M.waPhone('0092 300 1234567', '92'), '923001234567');
  assert.equal(M.waPhone('923001234567', '92'), '923001234567');
  assert.equal(M.waPhone('3001234567', '92'), '923001234567');
  assert.equal(M.waPhone('', '92'), '');
});

test('backup round-trip and validation', () => {
  const demo = S.demoData(TODAY);
  const res = S.parseBackup(S.serialize(demo));
  assert.equal(res.ok, true);
  assert.equal(res.data.customers.length, demo.customers.length);
  assert.equal(res.data.entries.length, demo.entries.length);
  const before = M.summarize(demo.customers, demo.entries, TODAY).map((s) => s.balance);
  const after = M.summarize(res.data.customers, res.data.entries, TODAY).map((s) => s.balance);
  assert.deepEqual(after, before);

  assert.equal(S.parseBackup('not json').ok, false);
  assert.equal(S.parseBackup('{"foo":1}').ok, false);
  const cleaned = S.parseBackup(JSON.stringify({
    customers: [{ id: 'x', name: 'X' }, { id: 'y', name: '' }],
    entries: [
      { id: '1', customerId: 'x', type: 'gave', amount: 100, date: '2026-10-01' },
      { id: '2', customerId: 'x', type: 'oops', amount: 100, date: '2026-10-01' },
      { id: '3', customerId: 'y', type: 'gave', amount: 100, date: '2026-10-01' },
      { id: '4', customerId: 'x', type: 'got', amount: -5, date: '2026-10-01' }
    ]
  }));
  assert.equal(cleaned.ok, true);
  assert.equal(cleaned.data.customers.length, 1);
  assert.deepEqual(cleaned.data.entries.map((e) => e.id), ['1']);
});

test('demo data has a mix of statuses', () => {
  const demo = S.demoData(TODAY);
  const sums = M.summarize(demo.customers, demo.entries, TODAY);
  assert.ok(sums.some((s) => s.overdue));
  assert.ok(sums.some((s) => s.status === 'settled'));
  assert.ok(sums.some((s) => s.status === 'advance'));
});

test('CSV export escapes cells and includes running balance', () => {
  const data = {
    customers: [cust('a', 'Khan, "Tea" Stall')],
    entries: [entry('a', 'gave', 1000, '2026-10-01', { note: '=HYPERLINK()' }), entry('a', 'got', 1500, '2026-10-02')]
  };
  const lines = S.toCSV(data).trim().split('\r\n');
  assert.equal(lines.length, 3);
  assert.equal(lines[1], '"Khan, ""Tea"" Stall",,2026-10-01,You gave,1000,,\'=HYPERLINK(),1000');
  assert.ok(lines[2].endsWith(',-500'));
});
