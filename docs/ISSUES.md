# Pitaka: Known issues

Found by `/code-review medium app.js` (#1–10) and `/ponytail-review app.js` (#11–13) on 2026-11-20 (Lesson 7C).
Found by reading the code; not yet reproduced in the app. **Both reviewers found #1**, so treat it as the most likely to be real.

**Severity:** *important* = a real bug someone can hit. *nit* = minor or unlikely.
**Decision:** *fix*, *accept* (known and fine for Pitaka), or *to decide*.

| # | Issue | Severity | Decision | Status |
|---|---|---|---|---|
| 1 | Deleting an account that has **received a transfer** is allowed; that money disappears from the records | important | to decide | open |
| 2 | Importing a backup with an **empty category list** makes saving entries of that type fail silently | important | to decide | open |
| 3 | When phone storage is **completely full**, import (or startup with damaged data) fails with no message | important | to decide | open |
| 4 | A backup containing a blank (`null`) item fails silently instead of saying "not a backup" | nit | to decide | open |
| 5 | Import doesn't check every detail (e.g. a transfer with no "to" account, a zero amount) | nit | to decide | open |
| 6 | **Export counts as "backed up" even if the download was cancelled**, which hides the reminder for 30 days | nit | to decide | open |
| 7 | Editing an entry whose account was deleted quietly moves it to another account | nit | to decide | open |
| 8 | Deleting a category shifts the chart colours of the categories after it | nit | to decide | open |
| 9 | If the app stays open past midnight, "Today" and the report month go stale until reopened | nit | to decide | open |
| 10 | With **Hide amounts** on, tapping an account still shows its real balance in the edit form | nit | to decide | open |
| 11 | If saved data is damaged, **every app opening adds another full copy**, which can eventually fill storage and stop the app starting | should fix | to decide | open |
| 12 | The **safety copy made before an import can't be restored on a phone**: nothing in the app can bring it back | should fix | to decide | open |
| 13 | The same "small grey text" line is written three times instead of reusing the `span()` helper | nice to have | to decide | open |

## Details

1. **Account delete ignores incoming transfers.** The safety check only looks at entries *from* the account (`t.account`), not transfers *to* it (`t.to`).
   *Example:* transfer ₱500 BDO → GCash, then delete GCash. BDO stays ₱500 lower, and the transfer now says "BDO to Cash".
2. **Empty category list from a backup.** `isValidBackup` accepts `"income": []`, so the form has no category buttons and Save crashes.
3. **Storage full.** The safety copies (`-unreadable-` and `-before-import`) are saved with no error handling.
4. **`null` in a backup.** The check reads `t.id` on `null` and crashes before the "not a backup" message can show.
5. **Shallow import check.** Missing category, missing transfer target, or zero amounts can produce blank rows, money vanishing, or "NaN%" in reports.
6. **Backup date set too early.** `lastBackup` is saved when Export is tapped. Browsers give no "download finished" signal.
7. **Missing account or category on edit.** The form falls back to the first account; saving rewrites the entry.
8. **Colours follow list position.** `categoryColor` uses the category's place in the list, so a deletion shifts the ones after it.
9. **Stale dates.** `reportMonth` and "Today" are computed when the app opens or redraws, not when it returns from the background.
10. **Hide amounts gap.** The edit forms fill in real amounts directly, not through `money()`.
11. **Copies of damaged data pile up** (`app.js:30`). The copy's name includes the time, so each opening adds one. Suggested fix: one fixed name (`${KEY}-unreadable`) plus `try/catch`. This also covers part of #3.
12. **Import safety copy unreachable** (`app.js:415`). It's saved to browser storage, which only a laptop's DevTools can reach. Suggested fix: call `exportBackup()` instead, so the current data downloads as a normal backup file before it's replaced.
13. **Repeated code** (`app.js:291, 320, 576`). Suggested fix: give `span()` a tag option. About −3 lines.

**Reviewers disagreed on #2:** `/code-review` rated it *important*; `/ponytail-review` rated it lower, because only a hand-edited backup can cause it (Pitaka's own exports can't).

## Fixed
*(Move issues here with the commit that fixed them.)*
