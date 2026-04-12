# MoneyInMotion - TODO Items

## P0 - Must Do

These are gaps in features that were claimed complete but have missing
pieces, or correctness issues that allow invalid data to be saved.

1. **Account edit and delete**
   - `AccountsPage` lists accounts and supports create, but has no
     edit or delete. Mistakes in an account config can only be
     corrected by hand-editing `Statements/<id>/AccountConfig.json`.
   - Fix: add an edit dialog (same form, pre-populated) and a delete
     action guarded by a confirmation prompt. Server needs
     `PUT /api/accounts/:id` and `DELETE /api/accounts/:id`.

2. **Per-account import status**
   - `AccountsPage` shows the folder path but not the last import
     date or how many transactions the account has contributed.
   - Fix: compute per-account stats server-side (transaction count
     and most recent `auditInfo.createDate` among them) and render
     on the card.

3. **Port configuration in Settings**
   - `config.ts` supports `MONEYAI_PORT` env var and a `port` field
     in `~/.moneyinmotion/config.json`, but `SettingsPage` only
     edits `dataPath`. Users who need a non-default port must edit
     the JSON by hand.
   - Fix: add a port input to Settings. Validate 1-65535. Note that
     port changes take effect after server restart (matching
     existing dataPath behaviour).

---

## P1 - High Priority Features

6. **Search Functionality**
   - Full-text search across entity names, notes, and categories.
   - Search by amount, date range, or account.
   - Highlight matching transactions in the list.

7. **Rules/Edits Editor UI**
   - View, edit, or delete existing edit rules.
   - Show which transactions are affected by each rule.
   - Filter rules by scope type, field, or target entity.

8. **Category Editor UI**
   - Dedicated page for managing the category hierarchy.
   - Rename, merge, and reorganize categories.
   - Category usage statistics (transaction count per category).

9. **Transaction Splitting**
   - Split a single transaction into multiple categories (e.g. a
     grocery trip with both food and household items).
   - Requires synthetic child transactions whose amounts sum to the
     parent.

10. **Support New Amex CSV Format**
    - Amex changed their CSV export layout; update `AmexParser`.

---

## P2 - Medium Priority Features

11. **Budgeting System**
    - Set spending limits by category or entity.
    - Track actual vs. budget by month/quarter/year.
    - Visual indicators when approaching or exceeding budget.

12. **Column Sorting and Filtering**
    - Make transaction columns sortable (by amount, date, entity).
    - Add filter capability on the transaction list.
    - Leverage `@tanstack/react-table` column features.

13. **Show Total Deficit/Savings**
    - Display running totals for month, quarter, and year.
    - Show savings rate.
    - Historical trend visualization.

14. **Entity Historical Stats**
    - "You spent $X at Amazon last month, $Y this month".
    - Frequency of purchases from each merchant.

15. **Remember Last Selection**
    - Persist last selected year/month across page loads.
    - Persist expanded group state in `localStorage`.
    - Restore scroll position on navigation.

16. **Flat View with Sort and Filter**
    - Toggle between hierarchical grouped view and flat list view.
    - Full sort/filter capability on all columns in flat view.

17. **Mobile Responsive Layout**
    - Sidebars are hidden on small screens but no alternative
      navigation is provided.
    - Add mobile navigation (hamburger menu, bottom sheet, or tabs).

18. **Multi-User Audit Identity**
    - The server currently attributes all audit records to the OS
      user running the process (`setDefaultAuditUser(os.userInfo().username)`).
    - For multi-user deployments, audit trails should reflect the
      authenticated end user. Needs API authentication and
      per-request user threading — large feature; deferred until
      the single-user experience is polished.

---

## Known Issues

### P1 - Should Fix

19. **Non-Zero Total Transfers**
    - Inter-account transfers should net to zero.
    - Some unmatched transfers remain, causing non-zero totals.
    - Investigate matching algorithm edge cases.

### P2 - Nice to Fix

20. **Selected Month Highlight**
    - Currently-selected month is not visually highlighted in the
      `YearMonthNav` sidebar accordion.

---

## Technical Improvements

### P2 - Code Quality

21. **Expand Web Component Test Coverage**
    - Core domain logic has strong coverage. Web has only a smoke
      test for `App` plus the Zustand store tests — add component
      tests with `@testing-library/react` for the main flows
      (editing, navigation, empty states).

22. **Remove Hardcoded Values**
    - Transfer day tolerance is hardcoded to 3 days.
    - Amount tolerance is hardcoded in the parent-child matcher.
    - These should be configurable per account via `AccountConfig`.

23. **Add Transaction Source Tracking**
    - Track how each transaction was created: Import, Synthetic,
      Adjustment, Manual.
    - Helps debugging matching and deduplication issues.

24. **Improve PayPal Parser Robustness**
    - Current timezone handling is fragile.
    - Ignorable activity list may be incomplete.
    - Consider supporting PayPal API export format.

25. **API Error Responses**
    - Standardize error response format across all endpoints.
    - Include request ID for debugging.
    - Add structured error codes beyond HTTP status.

26. **Production Deployment**
    - Add Dockerfile for containerized deployment.
    - Document environment variables for production.
    - Add health check endpoint (`GET /api/health`).

27. **Configure ESLint**
    - `npm run lint` is currently broken (no `eslint.config.js`).
    - Either configure ESLint properly or remove the script.

---

## Recently Completed

Kept here briefly so reviewers can see what has recently changed.

- **Bulk edit confirmation wired up.** `CategoryEditor` and
  `AttributeEditor` now compute the affected transactions for any
  non-single-ID scope and show `EditConfirmDialog` with an
  affected-count + preview list before applying.
- **Edit-time validation.** Both editors now surface inline errors
  when the category path is empty, no attribute field is enabled,
  the entity name is blank while "Change Entity Name" is checked,
  the amount is not numeric, or the scope is empty. Invalid edits
  are no longer persisted to the edit log.
- **Timezone-correct month filtering.** `YearMonthNav` and
  `transactions-store.getFilteredTransactions` previously used
  local-timezone date accessors on UTC ISO strings, which
  mis-categorised transactions near month boundaries for users
  outside UTC. Both now use `getUTCFullYear` / `getUTCMonth`,
  with a regression test in `transactions-store.test.ts`.
- **Settings restart notice.** The "path updated" confirmation in
  `SettingsPage` now makes it clear that the running server still
  uses the old path until restart (the in-memory `FileRepository`
  and `TransactionCache` don't follow PUT /api/config changes).
