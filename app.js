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

let data = load();
data.accounts ??= []; // data saved before Step 3 has no accounts list

// Balance = income − expenses + adjustments (adjustments carry their own + or − sign).
function balance(accountId, transactions = data.transactions) {
  let sum = 0;
  for (const t of transactions) {
    if (t.account === accountId) sum += t.type === 'expense' ? -t.amount : t.amount;
  }
  return sum;
}
console.assert(balance('a', [
  { account: 'a', type: 'adjustment', amount: 1000 },
  { account: 'a', type: 'expense', amount: 150 },
  { account: 'a', type: 'income', amount: 50 },
  { account: 'a', type: 'adjustment', amount: -100 },
  { account: 'b', type: 'expense', amount: 999 },
]) === 800, 'balance');

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
  for (const name of data.categories[f.type.value]) {
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

  f.account.replaceChildren(...data.accounts.map((a) => new Option(a.name, a.id)), new Option('Cash', 'cash'));
  // Entries from before Step 3 have no account: treat them as Cash.
  f.account.value = tx ? tx.account ?? 'cash' : data.lastAccount ?? 'cash';
  if (!f.account.value) f.account.value = 'cash'; // last-used account was deleted

  document.getElementById('delete').hidden = !editingId;
  document.getElementById('duplicate').hidden = !editingId;
  dialog.showModal();
}

form.addEventListener('change', (e) => {
  if (e.target.name === 'type') renderCategories();
});

form.addEventListener('submit', () => {
  const tx = {
    id: editingId ?? newId(),
    type: f.type.value,
    amount: toCentavos(f.amount.value),
    category: f.category.value,
    account: f.account.value,
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

function openAccount(account) {
  editingAccount = account ?? null;
  document.getElementById('account-title').textContent = account ? 'Edit account' : 'Add account';
  document.getElementById('balance-label').textContent = account ? 'Actual balance (₱)' : 'Starting balance (₱)';
  af.name.value = account?.name ?? '';
  af.balance.value = account ? (balance(account.id) / 100).toFixed(2) : '';
  document.getElementById('delete-account').hidden = !account;
  accountDialog.showModal();
}

document.getElementById('account-form').addEventListener('submit', () => {
  const account = editingAccount ?? { id: newId() };
  account.name = af.name.value.trim();
  if (!editingAccount) data.accounts.push(account);

  // A starting balance or a correction is saved as an "adjustment" entry for the difference.
  const difference = toCentavos(af.balance.value) - balance(account.id);
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

function render() {
  // Home: total of all accounts (Cash has no balance)
  const total = data.accounts.reduce((sum, a) => sum + balance(a.id), 0);
  document.querySelector('.balance').textContent = peso.format(total / 100);

  // Home: recent entries, newest date first; within a date, the most recently added first.
  const recent = data.transactions
    .filter((t) => t.type !== 'adjustment')
    .reverse()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 20);

  document.getElementById('recent').replaceChildren(...recent.map((tx) => {
    const what = span('what', tx.category);
    if (tx.note) what.append(Object.assign(document.createElement('small'), { textContent: tx.note }));
    const sign = tx.type === 'income' ? '+' : '−';
    return row(tx.type, [span('when', formatDate(tx.date)), what, span('amt', sign + peso.format(tx.amount / 100))], () => openForm(tx));
  }));
  document.getElementById('recent-empty').hidden = recent.length > 0;

  // Accounts tab
  document.getElementById('account-list').replaceChildren(...data.accounts.map((account) =>
    row('account', [span('what', account.name), span('amt', peso.format(balance(account.id) / 100))], () => openAccount(account))));
  document.getElementById('accounts-empty').hidden = data.accounts.length > 0;
}

render();
