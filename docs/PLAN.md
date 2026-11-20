# Pitaka: Plan

Pitaka (Tagalog for "wallet") is a personal finance tracker.

Decisions made in the first planning session (2026-11-20).

## Goal
Track daily spending, income and account balances on an Android phone. See monthly reports by category.
Later: budgets, savings goals and receipt photos.

## Version 1 (build now)

### Entry types
- **Expense**, **Income**, **Transfer** (a 3-way switch at the top of the add form).
- Transfers move money between accounts and never count as spending or income.
- Credit card bill payments are transfers (bank/e-wallet → card).

### Currency
- Philippine pesos (₱) only.

### Accounts
- **Banks and e-wallets**: listed separately, each with its own balance, plus a combined total.
- **Credit cards**: track the amount owed (purchases − payments). They count against you, not toward your total.
- **Cash**: not a tracked account. "Cash" is an account choice with no balance; spending it is just an expense.
- **Adjust balance**: "Set actual balance" records the difference as an *Adjustment* entry.
  Adjustments are left out of the Spending report. The same mechanism sets an account's starting balance.

### Credit cards: two reports
- **Spending report**: every purchase in the month it was made, by category (card purchases included).
- **Cash flow report**: income − money that left banks and e-wallets (expenses + card bill payments) = saved this month.
- Interest and late fees: record as a card expense in the **Interest** category.

### Categories (editable: add, rename, delete)
- Expense: Food, Grocery, Bills, Transportation, Interest, Gifts & Treats, Other
- Income: Income

### Add form
| Field    | Required | Default                       |
|----------|----------|-------------------------------|
| Type     | yes      | Expense                       |
| Amount   | yes      | number keypad opens           |
| Category | yes*     | big tap buttons               |
| Account  | yes      | last used (transfer: from/to) |
| Date     | yes      | today                         |
| Note     | no       | empty                         |

\*Hidden for transfers. No time-of-day field.

### Screens
- **Bottom tabs**: Home · Accounts · Reports · Settings, plus a big **+** button that is always visible.
- **Home**: total balance, credit cards owed, this month's spending with its top categories, recent entries.
- **Accounts**: each account with its balance; Adjust balance.
- **Reports**: month picker, Spending | Cash flow switch, donut chart, total vs last month,
  category list (tap a category to see its transactions), **Save as PDF** (browser print + print stylesheet).
- **Settings**: categories, export/import.

### Other features
- Edit and delete transactions (delete asks "Are you sure?").
- **Duplicate** a transaction (copied with today's date).
- **👁 Hide amounts** toggle (shows ₱••••).
- **App shortcut**: long-press the icon → "Add expense".
- **Backups**: export everything as one JSON file, import it to restore, plus a **monthly** reminder banner.
- Works offline and installs to the home screen (PWA).

## Later versions (not planned in detail yet)
- **V2**: monthly budget per category, savings goals.
- **V3**: attach receipt photos, then read the amount automatically with Tesseract.js (free, runs on the phone).
- **V4 ideas**: a real home-screen widget (needs a native wrapper + Kotlin), PIN lock, automatic recurring entries,
  more income categories, yearly view.

## Decided against (for now)
- Multiple currencies, sub-categories, time of day, quick-add button, automatic recurring entries, PIN lock.
- Paid or cloud services of any kind (data stays on the phone).
