# UX density, clarity, and accessibility review — 2026-09-18

This is the screenshot-led follow-up to [the lifecycle review](UX_LIFECYCLE_REVIEW.md).
The goal is to make existing financial capabilities discoverable, readable, and
efficient without changing the financial schema or rewriting imported values.
This pass followed the Product Design audit workflow: capture the current
experience, inspect task flows, implement repairs, then inspect the result in
local Chromium. Screenshots contain financial information and remain local;
they are not repository assets or uploaded to an external review service.

Reusable lessons now live in the [UX design guide](UX_DESIGN_GUIDE.md), with the
originating critiques in [feedback traceability](UX_FEEDBACK_TRACEABILITY.md).
Use the [review template](UX_REVIEW_TEMPLATE.md) for subsequent work. The evidence,
contrast measurements, and acceptance counts below belong to this dated run,
not a standing guarantee for every state or future change.

## Scope and evidence

Reviewed Accounts, account creation/duplication/editing, Imports and file
navigation, Rules and result inspection, Overview, Transactions, and Settings.
Browser mutations ran against an isolated copy. The production app's config
write endpoint was replaced with a rejecting handler in that harness. The live
snapshot, saved rules, and application config were hashed to check preservation.

The local evidence directory for this run is
`/tmp/mim-design-review-oICsiU/`. This temporary path is an audit artifact, not
a runtime dependency, portable test fixture, or permanent screenshot archive.

| Task                     | Before finding                                                                             | Implemented result                                                                                                                               | Local evidence                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Read account tasks       | OS dark preference activated pale warning text while page surfaces stayed light            | Complete light palette, semantic foreground/background/border pairs, compact notices                                                             | `02-accounts-before-dark.png`, `09-accounts-after-dark.png`                                         |
| Manage several accounts  | Warnings displaced the working list; details occupied every card                           | At ≥1600px: stats / account list / tasks. At ≥1280px: content / tasks. On small screens: summary tiles and collapsible tasks                     | `09-accounts-after-dark.png`, `18-accounts-mobile-fixed.png`                                        |
| Edit account settings    | Routine consequences appeared as a large warning; save required a separate rebuild trip    | Two-column desktop form, clear field guidance, **Save and rebuild**, progress and explicit second-step failure handling                          | `03-account-editor-before.png`, `10-editor-after.png`, `19-save-rebuild-result.png`                 |
| Duplicate an account     | Preserve the existing unsaved-copy guarantee while simplifying the form                    | Blank new ID, editable copied settings, no create/rebuild request until explicit confirmation                                                    | Browser request monitoring and AccountsPage tests                                                   |
| Find input statements    | Snapshot references could not show excluded/unimported files or real folder structure      | Read-only Statement explorer with hierarchy, file/eligible counts, status reasons, search, sort, 50-row pages, source drill-down                 | `12-explorer-after.png`, `21-explorer-source-detail.png`, `22-source-transactions.png`              |
| Manage hundreds of rules | One large card per correction wasted space; low-impact rules dominated                     | 50-row expandable table, most matches first, impact group headings, correction/automation shortcuts, retained bulk/edit/preview/export workflows | `04-rules-before-viewport.png`, `11-rules-after.png`, `23-expanded-rule.png`, `24-rule-results.png` |
| Use a narrow screen      | Table spans still reserved space for hidden columns; folder navigation pushed content down | Responsive semantic colspans, mobile inline scope, expandable row actions, compact import view selector and folder tree                          | Mobile Chromium checks and StatementExplorer regression tests                                       |
| Read the overview        | Color had little hierarchy; useful reporting definitions needed to remain trustworthy      | Teal/indigo/blue metric surfaces with text labels, preserved explicit period and reporting-grain definitions                                     | `20-final-overview.png`                                                                             |
| Change app settings      | Narrow layout, duplicate header, implementation jargon suggesting multi-user login         | Consistent page header, configuration and maintenance columns, local data-folder explanation                                                     | `08-settings-before.png`, `20-final-settings.png`                                                   |

## Design and copy contracts

- Color reinforces meaning, never replaces a label or icon. Information is
  blue, success teal, warnings amber, destructive actions red, primary actions
  indigo. Hover and keyboard focus remain visible.
- Use direct verbs: **View transactions**, **Configure account**, **Remove
  account**, **Upload and rebuild**. Keep wire endpoint names such as
  `/reconnect` internal; changing user-facing terms does not require API churn.
- Routine consequences belong in an action label and contextual help. Important
  risks remain explicit: removing an account excludes its records on rebuild;
  creating a new configuration for an old folder requires the correct identity.
- Account file patterns and matching names are explained with examples. Excel
  is not a supported parser format; tell users to export CSV instead of implying
  `*.xls` works. A matching filename alone does not establish parseability.
- Dense tables expose frequent actions. Long rule conditions, creation metadata,
  and technical IDs are expandable. Changing display sort never changes rule
  execution order. An automation can have only one current match.
- **Clear value** and **restore imported value** are distinct operations. A blank
  rule value is no longer displayed as an unexplained empty label.
- Filesystem modification times are not import times. Eligible files are not
  necessarily imported files. Source records include parent payments and child
  items, so their count and summed amounts are not a spending total.

The application currently has one complete light theme. Tailwind dark variants
require an explicit class; an OS dark preference must not activate isolated
dark text over light surfaces. A future dark theme must include all tokens,
surfaces, native controls, notices, and charts, not just text overrides.

Computed text/background contrast in Chromium was 10.21:1 for information,
7.48:1 for success, 8.45:1 for warnings, and 8.49:1 for the primary action.
These ratios apply to these token pairs, not a claim about every possible
overlay, chart, disabled control, or future component.

## Implementation and safety

- Account save and rebuild remain two operations. The form locks during either
  step. If saving fails, it stays open and does not rebuild. If rebuilding fails,
  the settings remain saved, the previous transaction history remains, and the
  account page lists failures and the retry path. Successful results include
  unavailable rule targets when returned by the server.
- `statement-inventory-service.ts` derives file metadata from the active data
  tree. It reads account configuration but not statement contents, never follows
  links, and bounds traversal at 20,000 entries / 40 levels. Partial inventory is
  labeled incomplete. Linked account configurations are rejected consistently
  by account discovery rather than treated as ordinary configuration files.
- The explorer joins source references by normalized relative path; it does not
  infer byte identity or first-import events. It distinguishes an unavailable
  transaction history from a known history with no matching source reference.
- File-explorer folder/search/status/sort/page state lives in the URL, preserving
  drill-down → Back behavior. It is view state, not application configuration.
- Rules reuse the existing graph-wide effects calculation and preview/commit
  workflow. Rows are bounded, but the transaction graph is still loaded in the
  browser; this is not a server-pagination redesign.
- Source date coverage now uses the same UTC date parser as transaction reports,
  including legacy date strings and edited dates with timezone offsets.
- Shared palette/layout primitives are in `globals.css`, `Notice`, `Badge`, and
  `Button`. `useMediaQuery` keeps semantic table spans aligned with CSS-visible
  columns; fixed spans reintroduce empty mobile columns and squeezed text.

No new persisted financial fields, event journal, account archive, or rule
revision history was added. Proposed data enhancements remain in
[the lifecycle review's data-enhancement section](UX_LIFECYCLE_REVIEW.md).
The file-list API is a read-only projection, not a new storage schema.

## Verification and limitations

Acceptance passed: **66 test files / 741 tests**, TypeScript, ESLint, Prettier,
the optimized production build, and production-mode HTTP smoke tests.

The automated suite adds coverage for save/rebuild success and partial failure,
unsaved account copies, file eligibility/counts, nested config exclusion, links,
traversal limits, folder navigation, filtering, paging, URL-restored state, and
UTC source coverage. Existing rule CRUD/preview/bulk tests now exercise the table
instead of asserting obsolete card markup.

Local Chromium testing used the production build with 431 rules and more than
10,000 transaction records. It exercised account editing and rebuilding,
cancelled duplication with zero mutation requests, file-to-transaction links,
rule expansion/inspection/editor entry, mobile reflow, and the OS-dark-preference
case. Automated axe checks of the sampled main-page states reported no WCAG
2 A/AA or 2.1 AA violations. Manual screenshot review remained necessary for
checks the analyzer marked incomplete and for interaction density.

This is not a full WCAG certification or a guarantee of no defects. Browser
coverage is local Chromium, not Safari/Firefox, physical touch devices, every
zoom setting, or a screen-reader session. The tests do not establish performance
for millions of records. Some older history still cannot establish original
import times or missing rule targets; the UI explains those limits rather than
inventing provenance.

## Acceptance checklist and next work

1. Restart the app with `./run.sh` so both API and browser assets are current.
   Start at Accounts: check wide layout and **Account tasks** on a narrow screen.
2. Open Edit. Confirm labels, filename examples, and **Save and rebuild**. This
   action changes account settings and rebuilds all configured accounts, so use
   an isolated copy when deliberately testing failure cases.
3. Open Duplicate, edit the draft, then Cancel. No account should be created.
4. Browse a statement folder. Check counts, ignored-file reasons, search/sort,
   expansion, and an available **View transactions** link. Back should preserve
   the folder and filters. Do not expect every eligible file to have source links.
5. Open Rules. Check the impact order, correction/automation shortcuts, expanded
   detail, results, and existing edit/preview/bulk flows. Verify that sorting did
   not change saved rule order.
6. Review Overview and Settings with both light and dark OS preferences. Text
   should retain the same readable light palette.

Next priorities are user acceptance on the real workflows, a separate
screen-reader/cross-browser pass, and measured large-library behavior before
adding server-side paging. Review the import/rule journal separately as already
agreed; it is not a prerequisite for the schema-free file explorer.
