# UX guidelines

These guidelines distill the owner's feedback on earlier versions. Use them
when designing or reviewing any screen. They describe the result to aim for,
not a review process.

## Orientation and truth

- **Scope is always visible.** Every list, total, and chart shows its period,
  account filter, and basis (reporting items vs. all source records). The
  default view is the **latest month that has data**, not today's month,
  which may be empty.
- **Summary first, detail on demand.** Open on collapsed totals and groups.
  Skip a wrapper group that holds a single child; it adds a click and no
  information.
- **Never double count.** Order details replace their parent charge in
  reporting. Transfers are neither income nor spending. Source-record views
  show parents and children together but never sum them.
- **Never invent facts.** Distinguish zero from unknown, filesystem dates from
  import dates, and a path-derived ID from a checksum. Recorded activity is
  not a balance. Show missing evidence as missing.
- **Existing data is never treated as an empty setup.** If statements exist
  but no snapshot does, offer **Rebuild**, not onboarding. A failed read is an
  error, not "no records".
- **One source per setting.** App settings live only in `config.json`
  (editable in Settings). Account settings live only in each
  `AccountConfig.json`. No environment variables override them.

## Efficiency at real scale

- Design for years of history and hundreds of rules. Provide search, filters,
  stable sorting, visible result counts, and paging, and say whether an action
  applies to the page, the selection, or all filtered results.
- Use tables for many similar items, cards only for a few distinct summaries,
  and trees for hierarchy. A one-transaction correction gets a compact row,
  not a card.
- On wide screens use the width: stats on the left, work in the center,
  attention items on the right. On narrow screens, collapse side panels
  without hiding blockers.
- Count the clicks on common paths and remove needless steps, but keep the
  safety steps for risky actions.
- Drill-downs keep their context. Back, reload, and bookmarks restore the
  same view (state lives in the URL), and returning from a preview keeps the
  draft.

## Language and visuals

- Use direct task labels: "View transactions", "Configure account",
  "Mark for review", "Save and rebuild". Avoid internal terms such as
  "reconnect", "resettable", "parent-charge", or endpoint names.
- Explain inputs with concrete, truthful examples. For instance: "file
  filters are comma-separated patterns such as `*.csv`; other files are
  ignored." Never advertise an unsupported format such as Excel.
- Every unfamiliar badge or count explains what it means, why it is there,
  whether money is affected, and what to do. The explanation is reachable by
  keyboard and touch, not only by hover.
- Use color and icons generously to aid recognition, with real contrast. Pair
  color with text or icons, and check actual rendered contrast, including
  tinted panels and charts.
- Size a warning to its risk. Routine consequences belong in the button label;
  large warnings are for real risks such as excluding history or changing
  many records.

## Actions and results

- **Preflight before sending.** A misspelled folder or an over-limit
  selection blocks the action, names the offending item, and sends nothing.
- **Close the loop.** After an action, separate what was received, skipped,
  duplicate, saved, and rebuilt, and link to the affected records. Report
  partial success honestly, for example "settings saved, rebuild failed".
- **Duplicate opens an unsaved draft. Cancel never writes.** Locked fields
  explain why they are locked.
- **Name the real removal boundary.** Removing an account removes its
  configuration, not its statements. Say what happens on the next rebuild,
  and don't imply an undo that doesn't exist.
- **Bulk and single edits use the same safe flow**: an explicit count, mixed
  values shown, a preview, Back keeping the draft, and stale previews
  rejected.
- **Rules are explainable**: conditions, matched records, fields this rule
  controls, fields that later rules override, and unavailable targets
  explained with the next steps.

## Checking your work

Look at the actual rendered screens with realistic data: existing history,
long names, hundreds of rules, empty and error states, and narrow and wide
widths. Passing tests and old screenshots don't prove a screen is usable.
Fix the cause, then check sibling screens for the same problem.
