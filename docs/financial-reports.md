# Overview and financial reports

The Overview is a read-only projection of the saved transaction graph. It does
not create a second ledger, change imported values, or persist a reporting
schema. All drill-downs lead to the same transaction explorer through the shared
`transaction-navigation.ts` URL contract.

## Questions the overview answers

- What credits and debits are recorded in a clearly stated period?
- Which categories and merchants account for outgoing amounts?
- Are incoming amounts payments, discounts, returns, or other credits?
- Which records need a category, a review, or matching attention?
- Which source accounts contributed the displayed items?
- Which existing transfer records are linked to each other?
- What transactions support each number, and how can I export the result?

The initial period is the **latest available month**, not the computer's current
month. Users can select a recorded month, latest available year, all recorded
dates, or inclusive custom dates. Every figure follows that scope and the source
account filter. The available-record dates are shown separately from the selected
period: neither proves that all statements for the interval have been imported.
Period/account choices are URL view state, so drill-down, browser Back, reload,
and bookmarking retain the chosen report scope without persisting new data.

## Accounting and date semantics

`lib/financial-reports.ts` contains pure calculations, with no filesystem, API,
DOM, or mutable store dependency. It shares the explorer's accounting grain:

1. Start with top-level records.
2. For a complete payment/order hierarchy, recurse into children instead of
   counting the parent again.
3. For an incomplete hierarchy, count the parent payment once rather than its
   incomplete children.
4. Apply effective corrected dates, amounts, types, categories, and names.
5. Compare UTC calendar days against the inclusive selected range.
6. Filter by the reporting item's source `accountId`, if selected.

The _net-activity population_ excludes items classified as account transfers and
unmatched order details. For that population:

| Figure                            | Definition                                                                            |
| --------------------------------- | ------------------------------------------------------------------------------------- |
| Recorded credits                  | Sum of `max(correctedAmount, 0)`.                                                     |
| Recorded debits                   | Sum of `-min(correctedAmount, 0)`, displayed as a positive magnitude.                 |
| Net activity                      | Recorded credits minus recorded debits.                                               |
| Category/merchant outgoing amount | Debits grouped by category/displayed merchant; before subtracting refunds or credits. |
| Credit type                       | Positive amounts grouped by corrected transaction reason.                             |
| Source-account activity           | The same population and measures, grouped by each item's source account.              |

Credits include refunds and discounts. **Net activity is not a bank balance,
earned income, net worth, or verified savings.** Account transfers and unmatched
details are explicitly counted separately from activity totals.

Category grouping uses the user's category path first, then the provider's
category, then `Uncategorized`. An order detail can belong to an Amazon/PayPal
source account while the parent payment belongs to a card. Accordingly,
source-account contribution is not a funding-account cash-flow statement.

Amounts retain the existing application's USD display. The domain does not have
currency metadata or exchange rates, and no currency conversion is performed.
Different currencies must not be combined on the assumption that USD formatting
normalizes them.

## Trends and chart accessibility

When the scope contains one active month, the chart shows daily activity;
broader histories show monthly activity. At most the latest 12 active periods
are drawn, with an explicit truncation notice. The exact-value table includes
all active periods at the displayed granularity. The aggregate export includes
both monthly and daily rows.

Periods with no recorded activity are omitted, not presented as confirmed zero
activity or missing imports. Bar sizes share one scale across credits and debits
within the drawn chart. Color is supplemented by labeled legends, distinct bar
positions, exact accessible link names, hover hints, and a table alternative.
Chart links retain the account scope and intersect their period with the custom
range, so a partial-month view does not silently widen its dates.

## Review queues and linked accounts

Flags and incomplete/unmatched record queues inspect the **full source graph**,
including parent records replaced by details in reporting. Their links use
`basis=records`. Source-record counts are not financial totals. The uncategorized
queue uses the reporting population and `basis=reporting` so its count agrees
with the visible items needing categorization.

Transfer interactions use only existing `relatedTransferId` relationships; this
view does not infer or persist a new match. A pair is deduplicated by its sorted
transaction IDs and appears once when either endpoint is in the selected scope.
Both sides are available in the drill-down even if a counterpart is outside the
selected dates/account. The UI marks out-of-period counterparts. If effective
amounts are no longer opposite, the direction is unclear, or the backlink is
inconsistent, it asks for review rather than presenting a movement total.

Linked pairs remain historical relationships even if a user changes a record's
classification. Activity exclusion follows the current transaction type, not
the mere existence of a relationship. The transfer panel explains that condition.

## Export and print

`financialReportCsv()` exports clearly labeled sections for totals, months,
days, outgoing categories, merchants, credit types, and source-account activity.
Each row includes the selected UTC dates and source-account scope. Rows in
different sections are alternate breakdowns of the same population and must not
be summed together. Text cells are quoted and spreadsheet-formula escaped;
numeric negatives remain numeric. Transfers/review counts are not added to the
activity export as if they were money amounts.

The shared `downloadText()` helper creates the local browser download and
releases its object URL. No export is uploaded to another service. Transaction
exports remain separate from aggregate reports and use the explorer's explicit
scope/basis controls.

Print uses the current report presentation and browser Print / Save as PDF.
Navigation and action controls are hidden; the selected scope and explanatory
labels remain. Expand details or groups before printing if they should appear.
For every group and numeric row, including those not currently expanded, use the
aggregate CSV. Printing is not a second calculation implementation.

## Module boundaries

| Module                                   | Responsibility                                                                                  |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `lib/financial-reports.ts`               | Reporting grain, filters, totals, breakdowns, transfer projections, CSV.                        |
| `pages/ReportsPage.tsx`                  | API loading/empty/error states, date/account scope, overview composition, export/print actions. |
| `components/reports/ActivityChart.tsx`   | Bounded trend chart, accessible exact-value table, period drill-downs.                          |
| `components/reports/BreakdownPanel.tsx`  | Bounded category/merchant/type groups with exact-value links and progressive disclosure.        |
| `components/reports/ReviewQueue.tsx`     | Counted exception queues and explanation of their reporting/source basis.                       |
| `components/reports/AccountActivity.tsx` | Source-account table and existing transfer-pair inspection.                                     |
| `components/reports/ReportPanel.tsx`     | Shared section headings, boundaries, and layout.                                                |
| `components/reports/reports.css`         | Print-only presentation.                                                                        |

Keep new calculations in the pure module. Reuse the shared reporting grain and
navigation contract rather than reproducing financial filtering inside JSX.
Changes to persistent data, history, currency, balances, or manual matching
require a separate user-reviewed schema proposal.

## Verification

Focused unit and interaction tests live in:

- `packages/web/__tests__/lib/financial-reports.test.ts`
- `packages/web/__tests__/pages/ReportsPage.test.tsx`

They cover complete/incomplete parents, hidden parent flags, immutable source
serialization, effective edits, UTC/custom boundaries, source-account attribution,
transfer deduplication and changed/out-of-period counterparts, credits versus
earnings, CSV safety, initial period, exact URL drill-downs, daily/monthly chart
selection, calculation hints, exports, print invocation, and loading/error/empty
states. Browser review should additionally inspect 320 px and desktop reflow,
keyboard operation, chart/table readability, print layout, and the actual result
counts after following each drill-down.
