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

// ---------- Add / edit form ----------
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
    date: f.date.value,
    note: f.note.value.trim(),
  };
  const i = data.transactions.findIndex((t) => t.id === tx.id);
  if (i >= 0) data.transactions[i] = tx;
  else data.transactions.push(tx);
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

document.getElementById('cancel').addEventListener('click', () => dialog.close());
document.querySelector('nav .add').addEventListener('click', () => openForm());

// ---------- Home: recent entries ----------
function formatDate(date) {
  if (date === today()) return 'Today';
  return new Date(`${date}T00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

function span(className, text) {
  return Object.assign(document.createElement('span'), { className, textContent: text });
}

function render() {
  // Newest date first; within the same date, the most recently added first.
  const recent = [...data.transactions].reverse().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20);

  document.getElementById('recent').replaceChildren(...recent.map((tx) => {
    const what = span('what', tx.category);
    if (tx.note) what.append(Object.assign(document.createElement('small'), { textContent: tx.note }));

    const sign = tx.type === 'income' ? '+' : '−';
    const button = document.createElement('button');
    button.className = tx.type;
    button.append(span('when', formatDate(tx.date)), what, span('amt', sign + peso.format(tx.amount / 100)));
    button.addEventListener('click', () => openForm(tx));

    const li = document.createElement('li');
    li.append(button);
    return li;
  }));

  document.getElementById('recent-empty').hidden = recent.length > 0;
}

render();
