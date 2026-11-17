# Overview and financial reports

The Overview is a read-only projection of the saved transaction graph. It does
not create a second ledger, change imported values, or persist a reporting
schema. All drill-downs lead to the same transaction explorer through the shared
`transaction-navigation.ts` URL contract.

## Questions the overview answers

- How much did I earn, spend, and save in a clearly stated period?
- Where did the money go, by category and merchant, after refunds?
- Where did income come from?
- Which credits can't be classified, and which records need review?
- Which source accounts contributed, and which transfers are linked?
- Which transactions support each number, and how can I export the result?

The initial period is the **latest available month**, not the computer's current
month. Users can pick a recorded month, the latest year, all dates, or custom
dates. Every figure follows that scope and the account filter. Period and
account are URL state, so drill-down, Back, reload, and bookmarks keep them.
The available-record dates are shown separately and don't prove that every
statement for the period was imported.

## Reporting grain

`lib/financial-reports.ts` and `lib/cash-flow.ts` are pure: no filesystem, API,
DOM, or store access. Both use the explorer's grain:

1. Start with top-level records.
2. For a complete payment/order hierarchy, use the children instead of the
   parent, so nothing is counted twice. For an incomplete one, count the parent
   payment once.
3. Use corrected dates, amounts, types, categories, and names.
4. Compare UTC calendar days against the inclusive selected range, and filter by
   the item's source `accountId` if one is selected.

## Income, spending, savings

`cash-flow.ts` classifies each reporting item:

| Kind      | Rule                                                                                                                                                                                                                                      |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Spending  | Any expense-type record: purchase, fee, check, ATM, loan payment, cash advance. Returns, discounts, and match-adjustment credits are expense types with positive amounts, so they **reduce** spending.                                    |
| Income    | Interest, plus deposits (other credit, check or payment received, credit adjustment) into a **checking or savings** account. Any income-type record whose type the user set explicitly, or whose amount is zero or negative (a reversal). |
| Undecided | Other income-type credits, such as card statement credits, PayPal receipts, or reward points. They are excluded from both totals and listed for the user to decide.                                                                       |
| Excluded  | Transfers and account payments (inter-account types), and unmatched order details.                                                                                                                                                        |

**Income** is the sum of income items. **Spending** is gross spending minus the
offsets (refunds, returns, discounts). **Savings** (shown as **Deficit** when
negative) is income minus spending. None of these is an account balance.

**Deciding unclear credits.** The Overview shows how many credits are undecided
and links to them (`flow=undecided`). Selecting them shows **Count as income**
(sets the type to _Other credit_) and **Count against spending** (sets the type
to _Return_). Both open the normal preview-and-save edit flow, so a decision is
an ordinary saved correction. It can be broadened into a rule (for example, all
"AMEX STATEMENT CREDIT" rows) or deleted later. Any explicit type correction
counts as a decision, even one that keeps the same type.

**Card payments that may be counted twice** (derived, never stored). A
checking or savings payment to a card that transfer matching couldn't pair
stays a purchase and counts as spending. When the card's statements for that
time aren't imported, that is right: the payment is the only record of those
purchases. When they are, the money is likely counted twice. So
`cardPaymentsToReview` lists a bank debit that counts as spending, has no
type decision, and has a credit card's name tag at the start of a word in its
imported name, but only when that card has records in the 40 days up to the
payment. The Overview queue links to them (`review=cardpayments`). Selecting
them shows **Count as card payment** (type _Account payment_, excluded like a
transfer) and **Keep as spending** (type _Purchase_, set explicitly), through
the same preview-and-save flow.

**Refund links** (derived, never stored). Each spending credit is linked to the
charge it most likely reverses: same merchant, on or before the refund, within
180 days, with enough unrefunded amount left. An exact amount wins, then the
nearest date, then the ID. Several partial refunds may share one charge but
never exceed it, and order details already under a payment are skipped. The
links are used to:

- count an uncategorized refund against the **category of the charge**, so a
  returned jacket reduces "Clothing"; and
- show "Likely refund of …" on the refund and "Refunded … · net cost …" on the
  charge in the transaction details.

**Breakdowns.** Category and merchant panels show spending net of refunds;
groups whose net spending is zero or negative are hidden. "Where income comes
from" groups income by payer. Every figure links to the transaction list with
the same population (`flow=income|spending|undecided|cashflow`), and a spending
drill-down by category uses the same inherited refund category.

**Recorded credits and debits.** The older measures remain available in the
export, the account table, and the transaction filters (`flow=credits|debits|activity`).
They cover everything except transfers and unmatched items, and they count
refunds as credits.

Amounts are USD. The domain has no currency metadata yet; see the planned
foreign-currency handling below.

## Trends and chart accessibility

When the scope contains one active month, the chart shows daily activity;
broader histories show monthly activity. At most the latest 12 active periods
are drawn, with an explicit truncation notice. The exact-value table includes
all active periods at the displayed granularity. The aggregate export includes
both monthly and daily rows.

The chart shows income and spending per period. Periods with neither are
omitted, not presented as confirmed zero activity or missing imports. Bar sizes
share one scale across income and spending within the drawn chart. Color is supplemented by labeled legends, distinct bar
positions, exact accessible link names, hover hints, and a table alternative.
Chart links retain the account scope and intersect their period with the custom
range, so a partial-month view does not silently widen its dates.

## Review queues and linked accounts

Flags and incomplete/unmatched record queues inspect the **full source graph**,
including parent records replaced by details in reporting. Their links use
`basis=records`. Source-record counts are not financial totals. The uncategorized
and card-payment queues use the reporting population and `basis=reporting` so
their counts agree with the visible items.

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

`financialReportCsv()` exports clearly labeled sections: the cash-flow summary
(income, spending with its gross and refund parts, savings, undecided credits),
months and days (income, spending, savings), spending categories and merchants,
income sources, credit types, and source-account activity.
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
