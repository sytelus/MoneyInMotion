# TODO

A short list of known work, tied to the [README goals](README.md#goals). Not
a schedule. Add items when real use shows a need.

## Product goals not yet implemented

- [ ] **Income / Spending / Savings reporting.** Replace the Overview's
      credits/debits/net-activity headline with earned income, spending net of
      refunds and discounts, and savings ([plan](docs/financial-reports.md#planned-income-spending-savings)).
- [ ] **Link refunds and returns to their original charges**, so net cost and
      partial refunds show up. `Statements/Amazon-returns` currently has no
      `AccountConfig.json`, so it isn't imported.
- [ ] **Foreign-currency transactions:** keep the original amount, currency,
      and rate; use the institution's conversion or a confirmed lookup by date
      ([plan](docs/financial-reports.md#planned-foreign-currency-transactions)).
      Decide on a rate source first.
- [ ] **Confirm legacy parity, then drop legacy compatibility.** Check the
      −27 / +$463.30 delta against the source statements for bugs, migrate
      once, and remove the legacy codecs and verifier
      ([details](docs/legacy-migration.md)).

## Known gaps

- [ ] End-to-end browser tests (Playwright) for import, edit, rule, backup,
      and restore journeys.
- [ ] Explain reconciliation decisions (why an order or transfer was linked),
      and allow durable manual link/unlink.
- [ ] Staging retention: list and remove old upload batches.
- [ ] Bound upload memory while decoding chunked multipart bodies.
- [ ] Coverage gaps: flag missing months per account so incomplete totals are
      visible.
- [ ] Undo a mistaken import (remove a batch's promoted files and rebuild).

## Ideas, only if real use calls for them

Subscriptions and recurring-charge detection, anomaly and fee alerts,
category management, split transactions, budgets, OFX/QFX import, dark theme,
server-side queries for much larger histories.
