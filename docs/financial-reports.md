# Overview and financial reports

The Overview is a read-only projection of the saved transaction graph. It does
not create a second ledger, change imported values, or persist a reporting
schema. All drill-downs lead to the same transaction explorer through the shared
`transaction-navigation.ts` URL contract.

This document describes the **current** calculations. The product goal
(see [README goals](../README.md#goals)) changes the headline measures; see
[Planned: income, spending, savings](#planned-income-spending-savings).

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

Amounts are USD. The domain has no currency metadata yet, so a source amount in
another currency would currently be summed as if it were USD. See the planned
foreign-currency handling below.

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

## Planned: income, spending, savings

The owner's chosen headline measures (not implemented yet):

- **Income**: earned income only (salary, interest, dividends, and other
  income-type credits). It excludes refunds, discounts, and transfers.
- **Spending**: purchases and fees **minus** the refunds, returns, and
  discounts that offset them, so a returned item no longer looks like income.
- **Savings / deficit**: income minus spending.
- **Unclear credits**: when a credit can't be classified confidently (for
  example a person-to-person payment or a reimbursement), it appears in a
  review queue. The user marks it as income or as an offset to spending, and
  that decision is saved as an ordinary rule.

Transfers stay outside all three, as they are today. Implementing this means
classifying credits by corrected transaction reason (refund, discount, return,
income) and, ideally, linking refunds to their original charges so category
and merchant spending is reduced in the right place. Linking needs matching
rules for refunds, which are not built yet. The current
credits/debits/net-activity figures can remain as a secondary detail view.

## Planned: foreign-currency transactions

All reporting stays in USD. For a non-USD transaction, the import should use
the converted amount when the institution supplies it. Otherwise it should
look up the rate for the transaction date from a public exchange-rate service
(only the currency pair and date are sent) and ask the user to confirm it. The
original amount, currency, rate, and rate source stay visible in the
transaction details so every USD value can be explained. This needs new
persisted fields, which is a schema change.

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
