# MoneyInMotion - TODO Items

## P0 - Must Do

No remaining P0 items. The current app meets the usable-version bar from
`GOAL.md`: users can configure accounts, upload statements, import and save
data, edit transactions with scoped rules, and inspect/revert those rules from
the web UI without losing audit history.

---

## P1 - High Priority Features

6. **Search Functionality**
   - Full-text search across entity names, notes, and categories.
   - Search by amount, date range, or account.
   - Highlight matching transactions in the list.

7. **Advanced Rules/Edits Management**
   - The usable-version bar only requires viewing and reverting rules.
   - Richer follow-up work still remains: editing an existing rule in place,
     advanced filtering by scope type/field/target entity, and more compact
     audit drill-down.

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

---

## Technical Improvements

### P2 - Code Quality

20. **Expand Web Component Test Coverage**
    - Core domain logic has strong coverage, and the web layer now
      covers the app shell, Zustand store, `AccountsPage`, and
      `SettingsPage`.
    - Remaining high-value gaps are the transaction editing dialogs,
      `WelcomePage` import flow, keyboard navigation, and responsive
      navigation states.

21. **Remove Hardcoded Values**
    - Transfer day tolerance is hardcoded to 3 days.
    - Amount tolerance is hardcoded in the parent-child matcher.
    - These should be configurable per account via `AccountConfig`.

22. **Add Transaction Source Tracking**
    - Track how each transaction was created: Import, Synthetic,
      Adjustment, Manual.
    - Helps debugging matching and deduplication issues.

23. **Improve PayPal Parser Robustness**
    - Current timezone handling is fragile.
    - Ignorable activity list may be incomplete.
    - Consider supporting PayPal API export format.

24. **API Error Responses**
    - Standardize error response format across all endpoints.
    - Include request ID for debugging.
    - Add structured error codes beyond HTTP status.

---

## Recently Completed

Kept here briefly so reviewers can see what has recently changed.

- **Rule history and revert UI is now shipped.** The web app now includes a
  dedicated **Rules** page that lists persisted edit rules, shows each rule's
  scope and current transaction matches, and lets users append a new voiding
  edit that restores imported values without deleting the original audit
  record.
- **Web date display now stays in UTC.** The shared web `formatDate()` helper
  now formats ISO timestamps with `timeZone: 'UTC'`, preventing dates from
  shifting backward or forward across local time zones in transaction and rule
  views.
- **Statement upload is now possible from the web UI.** Each account card now
  exposes an upload action that saves raw files into
  `Statements/<accountId>/` without requiring users to manipulate the data
  directory manually. The server now exposes
  `POST /api/accounts/:id/upload`, validates files against the account's
  configured file filters, and never overwrites an existing filename.
- **Parser selection is aligned with the UI and docs.** The parser factory now
  accepts canonical and human-readable institution names such as
  `AmericanExpress` / `American Express`, `BarclayBank` / `Barclay Bank`, and
  `PayPal`, so accounts created through the browser select the correct
  specialized parser instead of silently falling back to the generic one.
- **Full account management in the web UI.** `AccountsPage` now supports
  editing and deleting accounts in addition to create. The server now
  exposes `PUT /api/accounts/:id` and `DELETE /api/accounts/:id`. Delete
  intentionally removes only `AccountConfig.json` (and the empty folder if
  possible), leaving raw statement files untouched.
- **Per-account import status.** `GET /api/accounts` now returns
  transaction counts and the most recent `auditInfo.createDate` per
  account, and the Accounts page renders those stats on each card.
- **Port configuration in Settings.** `SettingsPage` now edits both
  `dataPath` and `port`, validates port `1-65535`, and makes it explicit
  that a server restart is required before either change takes effect.
- **Matching tags exposed in account form.** The account create/edit dialog
  now supports `interAccountNameTags` and `scanSubFolders`, which were
  previously only editable by hand in `AccountConfig.json` even though the
  transfer matcher and Amazon/Etsy parent-child matcher depend on those
  fields.
- **Production deployment surface added.** The repo now includes a
  production `Dockerfile`, `.dockerignore`, a dedicated deployment guide,
  and `GET /api/health` for container or external health checks.
- **ESLint is configured and runnable.** The repo now includes
  `eslint.config.js`, the supporting ESLint dependencies, and a working
  `npm run lint` command so source issues can be caught automatically.
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
- **Route and page test coverage expanded.** Server tests now cover
  `GET /api/health`, and web tests cover the main account-management
  and settings flows instead of relying only on the `App` smoke test
  plus store assertions.
