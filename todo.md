# TODO

A short list of known work, tied to the [README goals](README.md#goals). Not
a schedule. Add items when real use shows a need.

## Product goals not yet implemented

- [ ] **Card payments typed as purchases.** Checking-account payments to the
      cards (for example "Chase/autopay", "Amex Epayment") are typed as
      purchases, so they count as spending on top of the card purchases they
      pay for. Classify them as account payments, either with a rule or with
      better transfer matching.
- [ ] **Amazon refund/return reports.** `Statements/Amazon-returns` has no
      `AccountConfig.json` and no parser, so those files aren't imported. Card
      refunds are already linked to their charges.
- [ ] **Foreign-currency transactions:** keep the original amount, currency,
      and rate; use the institution's conversion or a confirmed lookup by date
      ([plan](docs/financial-reports.md#planned-foreign-currency-transactions)).
      Decide on a rate source first.
- [ ] **Drop legacy compatibility.** Parity is explained and two bugs it
      exposed are fixed ([details](docs/legacy-migration.md)). Waiting on the
      owner's go-ahead: rewrite the 8 PascalCase account configs once, then
      remove the legacy codecs and the verifier.

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
