# TODO

A short list of known work, tied to the [README goals](README.md#goals). Not
a schedule. Add items when real use shows a need.

## Product goals not yet implemented

- [ ] **Unpaired card payments.** A checking payment to a card with no
      matching card-side record stays a purchase and counts as spending. That
      is right when the card's statements for that time aren't imported (the
      payment is the only record of those purchases) and double counts when
      they are. Most such payments in real data fall outside card coverage.
      Show them with the card's coverage so the user can decide.
- [ ] **Amazon refund/return reports.** `Statements/Amazon-returns` has no
      `AccountConfig.json` and no parser, so those files aren't imported. Card
      refunds are already linked to their charges.
- [ ] **Foreign-currency transactions:** keep the original amount, currency,
      and rate; use the institution's conversion or a confirmed lookup by date
      ([plan](docs/financial-reports.md#planned-foreign-currency-transactions)).
      Decide on a rate source first.

## Known gaps

- [ ] Extend the Playwright journeys (`e2e/`) to rule management, restore,
      and account removal/reconfiguration.
- [ ] Explain reconciliation decisions (why an order or transfer was linked),
      and allow durable manual link/unlink.
- [ ] Staging retention: list and remove old upload batches.
- [ ] Bound upload memory while decoding chunked multipart bodies.
- [ ] Coverage gaps: flag missing months per account so incomplete totals are
      visible.
- [ ] Undo a mistaken import (remove a batch's promoted files and rebuild).
- [ ] **Parsing decisions that may change existing IDs** (check against real
      data with a rebuild comparison first): the IIF parser keeps an empty
      quoted field `""` as two quote characters; statement order uses
      locale-dependent `localeCompare`; the Amex, Barclay, Amazon and Etsy
      parsers ignore the file type; Papaparse guesses the delimiter.
- [ ] `GET /api/config` can rewrite the config file; a read should not write.
- [ ] Web: one shared `Transactions` graph per snapshot instead of one per
      page (store, Overview, Rules, Imports each rebuild it), and Rules and
      Transactions sort/page state in the URL.

## Ideas, only if real use calls for them

Subscriptions and recurring-charge detection, anomaly and fee alerts,
category management, split transactions, budgets, OFX/QFX import, dark theme,
server-side queries for much larger histories.
