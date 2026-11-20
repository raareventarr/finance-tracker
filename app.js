// ---------- Data ----------
const KEY = 'finance-tracker';
const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
const today = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// Money is stored as whole centavos (₱150.50 → 15050) so totals never get rounding errors.
const toCentavos = (text) => Math.round(Number(text) * 100);
console.assert(toCentavos('150.50') === 15050, 'centavo parse');
console.assert(toCentavos('0.1') + toCentavos('0.2') === 30, 'centavo sum');

function fresh() {
  return {
    transactions: [],
    accounts: [],
    categories: {
      expense: ['Food', 'Grocery', 'Bills', 'Transportation', 'Interest', 'Gifts & Treats', 'Other'],
      income: ['Income'],
    },
  };
}

function load() {
  const raw = localStorage.getItem(KEY);
  if (!raw) return fresh();
  try {
    return JSON.parse(raw);
  } catch {
    // Never overwrite unreadable data: keep a copy so it can be recovered.
    localStorage.setItem(`${KEY}-unreadable-${Date.now()}`, raw);
    alert('Your saved data could not be read. A copy was kept. Restore from a backup if you have one.');
    return fresh();
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    alert('Could not save. Your phone storage may be full.');
  }
}

// Bring data saved by older versions of the app (or an older backup) up to date.
function upgrade(d) {
  d.accounts ??= []; // before Step 3 there were no accounts
  for (const a of d.accounts) a.kind ??= 'bank'; // before Step 4 every account was a bank
  return d;
}

let data = upgrade(load());

// Every amount on screen goes through here, so "Hide amounts" covers them all.
const money = (centavos) => (data.hideAmounts ? '₱••••' : peso.format(centavos / 100));

// Balance = income − expenses − transfers out + transfers in + adjustments
// (adjustments carry their own + or − sign). A credit card's balance is negative: −balance = amount owed.
function balance(accountId, transactions = data.transactions) {
  let sum = 0;
  for (const t of transactions) {
    if (t.account === accountId) sum += t.type === 'expense' || t.type === 'transfer' ? -t.amount : t.amount;
    if (t.to === accountId) sum += t.amount;
  }
  return sum;
}
const sample = [
  { account: 'bank', type: 'adjustment', amount: 1000 },
  { account: 'bank', type: 'expense', amount: 150 },
  { account: 'bank', type: 'income', amount: 50 },
  { account: 'bank', type: 'adjustment', amount: -100 },
  { account: 'card', type: 'expense', amount: 300 },
  { account: 'bank', type: 'transfer', to: 'card', amount: 200 },
];
console.assert(balance('bank', sample) === 600, 'bank balance');
console.assert(balance('card', sample) === -100, 'card owes 100 after a partial payment');

const accountName = (id) => data.accounts.find((a) => a.id === id)?.name ?? 'Cash';

// ---------- Tabs ----------
const tabs = document.querySelectorAll('nav [data-tab]');

for (const tab of tabs) {
  tab.addEventListener('click', () => {
    for (const screen of document.querySelectorAll('main > section')) {
      screen.hidden = screen.id !== tab.dataset.tab;
    }
    for (const t of tabs) {
      if (t === tab) t.setAttribute('aria-current', 'page');
      else t.removeAttribute('aria-current');
    }
  });
}

// Every Cancel button closes the dialog it sits in.
for (const button of document.querySelectorAll('.cancel')) {
  button.addEventListener('click', () => button.closest('dialog').close());
}

// ---------- Add / edit entry ----------
const dialog = document.getElementById('entry');
const form = document.getElementById('entry-form');
const f = form.elements;
let editingId = null; // null = adding a new entry

function renderCategories(selected) {
  const box = document.getElementById('categories');
  box.querySelectorAll('label').forEach((label) => label.remove());
  for (const name of data.categories[f.type.value] ?? []) { // transfers have no categories
    const input = document.createElement('input');
    Object.assign(input, { type: 'radio', name: 'category', value: name, required: true, checked: name === selected });
    const label = document.createElement('label');
    label.append(input, name);
    box.append(label);
  }
}

// tx = entry to edit; an entry without an id is a copy (Duplicate) to save as new.
function openForm(tx) {
  editingId = tx?.id ?? null;
  document.getElementById('entry-title').textContent = editingId ? 'Edit entry' : 'Add entry';
  f.type.value = tx?.type ?? 'expense';
  f.amount.value = tx ? (tx.amount / 100).toFixed(2) : '';
  f.date.value = editingId ? tx.date : today();
  f.note.value = tx?.note ?? '';
  renderCategories(tx?.category);
  // Entries from before Step 3 have no account: treat them as Cash.
  updateForm(tx ? tx.account ?? 'cash' : data.lastAccount ?? 'cash', tx?.to);
  document.getElementById('delete').hidden = !editingId;
  document.getElementById('duplicate').hidden = !editingId;
  dialog.showModal();
}

// Show the fields that fit the type: transfers have From/To and no category, and can't use Cash.
function updateForm(from, to) {
  const transfer = f.type.value === 'transfer';
  const categories = document.getElementById('categories');
  categories.hidden = categories.disabled = transfer; // disabled = skipped by "required" checks
  document.getElementById('to-field').hidden = f.to.disabled = !transfer;
  document.getElementById('account-label').textContent = transfer ? 'From' : 'Account';

  const options = () => data.accounts.map((a) => new Option(a.name, a.id));
  f.account.replaceChildren(...options(), ...(transfer ? [] : [new Option('Cash', 'cash')]));
  f.to.replaceChildren(...options());
  f.account.value = from;
  if (!f.account.value) f.account.selectedIndex = 0; // account was deleted, or Cash on a transfer
  f.to.value = to ?? '';
  if (!f.to.value) f.to.selectedIndex = data.accounts.findIndex((a) => a.id !== f.account.value);
  checkTransfer();
}

function checkTransfer() {
  const same = f.type.value === 'transfer' && f.to.value === f.account.value;
  f.to.setCustomValidity(same ? 'Choose a different account to transfer to.' : '');
}

form.addEventListener('change', (e) => {
  if (e.target.name === 'type') {
    renderCategories();
    updateForm(f.account.value, f.to.value);
  }
  if (e.target.name === 'account' || e.target.name === 'to') checkTransfer();
});

form.addEventListener('submit', () => {
  const transfer = f.type.value === 'transfer';
  const tx = {
    id: editingId ?? newId(),
    type: f.type.value,
    amount: toCentavos(f.amount.value),
    category: transfer ? undefined : f.category.value,
    account: f.account.value,
    to: transfer ? f.to.value : undefined,
    date: f.date.value,
    note: f.note.value.trim(),
  };
  const i = data.transactions.findIndex((t) => t.id === tx.id);
  if (i >= 0) data.transactions[i] = tx;
  else data.transactions.push(tx);
  data.lastAccount = tx.account;
  save();
  render();
});

document.getElementById('delete').addEventListener('click', () => {
  if (!confirm('Delete this entry?')) return;
  data.transactions = data.transactions.filter((t) => t.id !== editingId);
  save();
  render();
  dialog.close();
});

document.getElementById('duplicate').addEventListener('click', () => {
  const tx = data.transactions.find((t) => t.id === editingId);
  dialog.close();
  openForm({ ...tx, id: undefined });
});

document.querySelector('nav .add').addEventListener('click', () => openForm());

// ---------- Add / edit account ----------
const accountDialog = document.getElementById('account');
const af = document.getElementById('account-form').elements;
let editingAccount = null; // null = adding a new account

// Cards are entered as "amount owed" (a positive number) but stored as a negative balance.
const isCard = () => af.kind.value === 'card';

function updateBalanceLabel() {
  document.getElementById('balance-label').textContent =
    isCard() ? 'Amount owed now (₱)' : editingAccount ? 'Actual balance (₱)' : 'Starting balance (₱)';
}

function openAccount(account) {
  editingAccount = account ?? null;
  document.getElementById('account-title').textContent = account ? 'Edit account' : 'Add account';
  af.kind.value = account?.kind ?? 'bank';
  document.getElementById('kind').hidden = !!account; // type can't change after creation
  af.name.value = account?.name ?? '';
  af.balance.value = account ? ((isCard() ? -1 : 1) * balance(account.id) / 100).toFixed(2) : '';
  updateBalanceLabel();
  document.getElementById('delete-account').hidden = !account;
  accountDialog.showModal();
}

af.kind.forEach((radio) => radio.addEventListener('change', updateBalanceLabel));

document.getElementById('account-form').addEventListener('submit', () => {
  const account = editingAccount ?? { id: newId(), kind: af.kind.value };
  account.name = af.name.value.trim();
  if (!editingAccount) data.accounts.push(account);

  // A starting balance or a correction is saved as an "adjustment" entry for the difference.
  const target = (isCard() ? -1 : 1) * toCentavos(af.balance.value);
  const difference = target - balance(account.id);
  if (difference !== 0) {
    data.transactions.push({
      id: newId(),
      type: 'adjustment',
      amount: difference,
      account: account.id,
      date: today(),
      note: editingAccount ? 'Balance adjustment' : 'Starting balance',
    });
  }
  save();
  render();
});

document.getElementById('delete-account').addEventListener('click', () => {
  const id = editingAccount.id;
  if (data.transactions.some((t) => t.account === id && t.type !== 'adjustment')) {
    alert('This account has entries. Delete them or move them to another account first.');
    return;
  }
  if (!confirm(`Delete ${editingAccount.name}?`)) return;
  data.accounts = data.accounts.filter((a) => a.id !== id);
  data.transactions = data.transactions.filter((t) => t.account !== id);
  save();
  render();
  accountDialog.close();
});

document.getElementById('add-account').addEventListener('click', () => openAccount());

// ---------- Screens ----------
function formatDate(date) {
  if (date === today()) return 'Today';
  return new Date(`${date}T00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

function span(className, text) {
  return Object.assign(document.createElement('span'), { className, textContent: text });
}

// One tappable row in a list.
function row(className, parts, onClick) {
  const button = document.createElement('button');
  button.className = className;
  button.append(...parts);
  button.addEventListener('click', onClick);
  const li = document.createElement('li');
  li.append(button);
  return li;
}

// One entry as a tappable row (Home's Recent list and the report's category lists).
function entryRow(tx) {
  const transfer = tx.type === 'transfer';
  const what = span('what', transfer ? 'Transfer' : tx.category);
  const detail = transfer ? `${accountName(tx.account)} to ${accountName(tx.to)}` : tx.note;
  if (detail) what.append(Object.assign(document.createElement('small'), { textContent: detail }));
  const sign = { income: '+', expense: '−', transfer: '' }[tx.type];
  return row(tx.type, [span('when', formatDate(tx.date)), what, span('amt', sign + money(tx.amount))], () => openForm(tx));
}

const newestFirst = (list) => [...list].reverse().sort((a, b) => b.date.localeCompare(a.date));

function render() {
  // Home: total of banks and e-wallets (Cash has no balance), and what the cards owe
  const banks = data.accounts.filter((a) => a.kind === 'bank');
  const cards = data.accounts.filter((a) => a.kind === 'card');
  const total = banks.reduce((sum, a) => sum + balance(a.id), 0);
  const owed = cards.reduce((sum, a) => sum - balance(a.id), 0);
  document.querySelector('.balance').textContent = money(total);
  const owedLine = document.getElementById('owed');
  owedLine.textContent = `Credit cards owed ${money(owed)}`;
  owedLine.hidden = cards.length === 0;

  // Home: recent entries, newest date first; within a date, the most recently added first.
  const recent = newestFirst(data.transactions.filter((t) => t.type !== 'adjustment')).slice(0, 20);

  document.getElementById('recent').replaceChildren(...recent.map(entryRow));
  document.getElementById('recent-empty').hidden = recent.length > 0;

  // Accounts tab: banks first, then cards
  document.getElementById('account-list').replaceChildren(...[...banks, ...cards].map((account) => {
    const what = span('what', account.name);
    let amount = money(balance(account.id));
    if (account.kind === 'card') {
      what.append(Object.assign(document.createElement('small'), { textContent: 'Credit card' }));
      amount = `${money(0 - balance(account.id))} owed`; // 0 − x avoids showing "−₱0.00"
    }
    return row('account', [what, span('amt', amount)], () => openAccount(account));
  }));
  document.getElementById('accounts-empty').hidden = data.accounts.length > 0;

  // Hide amounts toggle
  const toggle = document.getElementById('toggle-amounts');
  toggle.textContent = data.hideAmounts ? '👁 Show' : '👁 Hide';
  toggle.setAttribute('aria-pressed', String(!!data.hideAmounts));

  // Backup reminder on Home, and status in Settings
  const days = data.lastBackup ? daysSince(data.lastBackup) : null;
  document.getElementById('backup-banner').hidden = data.transactions.length === 0 || (days !== null && days < 30);
  document.getElementById('banner-text').textContent =
    days === null ? "You haven't backed up your data yet." : `Your last backup was ${days} days ago.`;
  document.getElementById('backup-status').textContent = days === null
    ? 'No backup yet. Export one and keep the file somewhere safe, like Google Drive.'
    : `Last backup: ${formatDate(data.lastBackup)}${days > 0 ? ` (${days} days ago)` : ''}.`;

  // Settings: categories (expense ones show their chart colour)
  for (const type of ['expense', 'income']) {
    document.getElementById(`${type}-categories`).replaceChildren(...data.categories[type].map((name) => {
      const parts = [span('what', name)];
      if (type === 'expense') {
        const swatch = span('swatch', '');
        swatch.style.background = categoryColor(name);
        parts.unshift(swatch);
      }
      return row('category', parts, () => openCategory(type, name));
    }));
  }

  renderReport();
}

const daysSince = (date) => Math.round((new Date(today()) - new Date(date)) / 86400000);

document.getElementById('toggle-amounts').addEventListener('click', () => {
  data.hideAmounts = !data.hideAmounts;
  save();
  render();
});

// ---------- Backups ----------
function exportBackup() {
  data.lastBackup = today();
  const file = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  const link = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(file),
    download: `finance-backup-${today()}.json`,
  });
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 10000); // give slower phones time to start the download
  save();
  render();
}
document.querySelectorAll('.export').forEach((button) => button.addEventListener('click', exportBackup));

// A backup file comes from outside the app, so check its shape before trusting it.
function isValidBackup(d) {
  const names = (list) => Array.isArray(list) && list.every((s) => typeof s === 'string');
  return typeof d === 'object' && d !== null
    && names(d.categories?.expense) && names(d.categories?.income)
    && Array.isArray(d.accounts) && d.accounts.every((a) =>
      typeof a.id === 'string' && typeof a.name === 'string' && ['bank', 'card'].includes(a.kind))
    && Array.isArray(d.transactions) && d.transactions.every((t) =>
      typeof t.id === 'string' && ['expense', 'income', 'transfer', 'adjustment'].includes(t.type)
      && Number.isInteger(t.amount) && /^\d{4}-\d{2}-\d{2}$/.test(t.date));
}
console.assert(isValidBackup(fresh()), 'empty data is a valid backup');
console.assert(!isValidBackup({ ...fresh(), transactions: [{ id: 'x', type: 'expense', amount: 1.5, date: '2026-11-01' }] }), 'reject non-centavo amount');
console.assert(!isValidBackup({ hello: 'world' }), 'reject other JSON');

document.getElementById('import').addEventListener('click', () => document.getElementById('import-file').click());

document.getElementById('import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = ''; // so picking the same file again still triggers this
  if (!file) return;
  let backup = null;
  try {
    backup = upgrade(JSON.parse(await file.text()));
  } catch {
    // not JSON, or not shaped like our data: caught by the check below
  }
  if (!isValidBackup(backup)) {
    alert("That file isn't a Finance Tracker backup. Nothing was changed.");
    return;
  }
  const accounts = backup.accounts.length;
  const entries = backup.transactions.filter((t) => t.type !== 'adjustment').length;
  const summary = `${accounts} ${accounts === 1 ? 'account' : 'accounts'}, ${entries} ${entries === 1 ? 'entry' : 'entries'}`;
  if (!confirm(`Replace ALL current data with this backup (${summary})?`)) return;
  localStorage.setItem(`${KEY}-before-import`, JSON.stringify(data)); // safety copy of what we're replacing
  data = backup;
  save();
  render();
  alert('Backup restored.');
});

// ---------- Categories ----------
const categoryDialog = document.getElementById('category');
const cf = document.getElementById('category-form').elements;
let editingCategory = null; // { type, name }; name is null when adding

function openCategory(type, name = null) {
  editingCategory = { type, name };
  document.getElementById('category-title').textContent = name ? 'Edit category' : `Add ${type} category`;
  cf.name.value = name ?? '';
  cf.name.setCustomValidity('');
  // Each type needs at least one category, or the add form can't be saved.
  document.getElementById('delete-category').hidden = !name || data.categories[type].length === 1;
  categoryDialog.showModal();
}

cf.name.addEventListener('input', () => {
  const { type, name } = editingCategory;
  const value = cf.name.value.trim();
  const taken = value !== name && data.categories[type].includes(value);
  cf.name.setCustomValidity(taken ? 'That category already exists.' : '');
});

document.getElementById('category-form').addEventListener('submit', () => {
  const { type, name } = editingCategory;
  const list = data.categories[type];
  const newName = cf.name.value.trim();
  if (!name) list.push(newName);
  else {
    list[list.indexOf(name)] = newName;
    // Renaming also renames past entries, so reports keep them together.
    for (const t of data.transactions) if (t.type === type && t.category === name) t.category = newName;
  }
  save();
  render();
});

document.getElementById('delete-category').addEventListener('click', () => {
  const { type, name } = editingCategory;
  if (!confirm(`Delete "${name}"? Past entries keep this category; you just can't pick it for new ones.`)) return;
  data.categories[type] = data.categories[type].filter((c) => c !== name);
  save();
  render();
  categoryDialog.close();
});

document.querySelectorAll('[data-add-category]').forEach((button) =>
  button.addEventListener('click', () => openCategory(button.dataset.addCategory)));

// ---------- Reports ----------
let reportMonth = today().slice(0, 7); // 'YYYY-MM'

function shiftMonth(month, by) {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1 + by, 1).toLocaleDateString('en-CA').slice(0, 7);
}
console.assert(shiftMonth('2026-01', -1) === '2025-12' && shiftMonth('2026-12', 1) === '2027-01', 'month math');

const monthName = (month, options = { month: 'long', year: 'numeric' }) =>
  new Date(`${month}-01T00:00`).toLocaleDateString('en-PH', options);

// Both reports for one month. Spending counts every purchase (cards included);
// cash flow counts only money that left banks, e-wallets and cash (card bills, not card purchases).
// Adjustments are never counted.
function monthReport(month, transactions = data.transactions, cardIds = new Set(data.accounts.filter((a) => a.kind === 'card').map((a) => a.id))) {
  const r = { byCategory: {}, spent: 0, income: 0, expensesPaid: 0, cardPayments: 0 };
  for (const t of transactions) {
    if (!t.date.startsWith(month)) continue;
    const onCard = cardIds.has(t.account);
    if (t.type === 'expense') {
      r.byCategory[t.category] = (r.byCategory[t.category] ?? 0) + t.amount;
      r.spent += t.amount;
      if (!onCard) r.expensesPaid += t.amount;
    }
    if (t.type === 'income' && !onCard) r.income += t.amount;
    if (t.type === 'transfer' && cardIds.has(t.to) && !onCard) r.cardPayments += t.amount;
  }
  r.saved = r.income - r.expensesPaid - r.cardPayments;
  return r;
}
{
  const r = monthReport('2026-11', [
    { date: '2026-11-01', type: 'income', account: 'bank', amount: 1000 },
    { date: '2026-11-02', type: 'expense', account: 'bank', category: 'Food', amount: 300 },
    { date: '2026-11-03', type: 'expense', account: 'card', category: 'Food', amount: 200 },
    { date: '2026-11-04', type: 'expense', account: 'cash', category: 'Bills', amount: 100 },
    { date: '2026-11-05', type: 'transfer', account: 'bank', to: 'card', amount: 150 },
    { date: '2026-11-06', type: 'transfer', account: 'bank', to: 'wallet', amount: 500 },
    { date: '2026-11-07', type: 'adjustment', account: 'bank', amount: 9999 },
    { date: '2026-10-31', type: 'expense', account: 'bank', category: 'Food', amount: 7777 },
  ], new Set(['card']));
  console.assert(r.byCategory.Food === 500 && r.byCategory.Bills === 100 && r.spent === 600, 'spending report');
  console.assert(r.income === 1000 && r.expensesPaid === 400 && r.cardPayments === 150 && r.saved === 450, 'cash flow report');
}

// Colour follows the category (its place in the category list), never its rank in the chart.
function categoryColor(name) {
  const i = data.categories.expense.indexOf(name);
  // shortcut: only 8 chart colours; categories past the 8th share grey. Fold small ones into Other if that happens.
  return i >= 0 && i < 8 ? `var(--c${i + 1})` : 'var(--muted)';
}

function compareText(now, before) {
  const last = monthName(shiftMonth(reportMonth, -1), { month: 'long' });
  if (now === before) return `Same as ${last}`;
  return `${now > before ? '▲' : '▼'} ${money(Math.abs(now - before))} vs ${last}`;
}

function renderReport() {
  const r = monthReport(reportMonth);
  const before = monthReport(shiftMonth(reportMonth, -1));
  const view = document.querySelector('[name="report"]:checked').value;
  document.getElementById('month-label').textContent = monthName(reportMonth);
  document.getElementById('spending-report').hidden = view !== 'spending';
  document.getElementById('cashflow-report').hidden = view !== 'cashflow';

  // Spending: donut + one expandable row per category, biggest first
  document.getElementById('spent-total').textContent = money(r.spent);
  document.getElementById('spent-compare').textContent = compareText(r.spent, before.spent);
  const categories = Object.entries(r.byCategory).sort((a, b) => b[1] - a[1]);
  const percent = (amount) => `${Math.round((amount / r.spent) * 100)}%`;

  let start = 0;
  const stops = categories.map(([name, amount]) => {
    const end = start + (amount / r.spent) * 360;
    const gap = categories.length > 1 ? 1.5 : 0; // thin gap between slices
    const stop = `${categoryColor(name)} ${start}deg ${end - gap}deg, transparent 0 ${end}deg`;
    start = end;
    return stop;
  });
  const donut = document.getElementById('donut');
  donut.style.background = `conic-gradient(${stops.join(', ')})`;
  donut.setAttribute('aria-label', categories.map(([name, amount]) => `${name} ${percent(amount)}`).join(', '));
  donut.hidden = categories.length === 0;
  document.getElementById('report-empty').hidden = categories.length > 0;

  document.getElementById('category-list').replaceChildren(...categories.map(([name, amount]) => {
    const swatch = span('swatch', '');
    swatch.style.background = categoryColor(name);
    const summary = document.createElement('summary');
    summary.append(swatch, span('what', name), span('pct', percent(amount)), span('amt', money(amount)));
    const entries = document.createElement('ul');
    entries.className = 'list';
    entries.append(...newestFirst(data.transactions.filter((t) =>
      t.type === 'expense' && t.category === name && t.date.startsWith(reportMonth))).map(entryRow));
    const details = document.createElement('details');
    details.append(summary, entries);
    return details;
  }));

  // Cash flow
  document.getElementById('saved-total').textContent = money(r.saved);
  document.getElementById('saved-compare').textContent = compareText(r.saved, before.saved);
  const flowRow = (label, note, amount, sign) => {
    const what = span('what', label);
    what.append(Object.assign(document.createElement('small'), { textContent: note }));
    const li = document.createElement('li');
    li.className = 'flow';
    li.append(what, span('amt', sign + money(amount)));
    return li;
  };
  document.getElementById('cashflow-list').replaceChildren(
    flowRow('Income', 'Into banks, e-wallets and cash', r.income, '+'),
    flowRow('Spent', 'From banks, e-wallets and cash', r.expensesPaid, '−'),
    flowRow('Credit card payments', 'Bills paid to your cards', r.cardPayments, '−'),
  );
}

document.getElementById('prev-month').addEventListener('click', () => {
  reportMonth = shiftMonth(reportMonth, -1);
  renderReport();
});
document.getElementById('next-month').addEventListener('click', () => {
  reportMonth = shiftMonth(reportMonth, 1);
  renderReport();
});
document.getElementById('report-view').addEventListener('change', renderReport);
document.getElementById('print').addEventListener('click', () => window.print());

render();
