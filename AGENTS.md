# Repository working guidance

Preserve unrelated working-tree changes. Read the relevant current contracts in
[docs/README.md](docs/README.md) before modifying behavior.

## UX design, implementation, and review

- Read [UX_DESIGN_GUIDE.md](docs/UX_DESIGN_GUIDE.md) before UX-affecting work,
  including copy, layout, navigation, defaults, imports, rules, reports, and edits.
- Consult [UX_FEEDBACK_TRACEABILITY.md](docs/UX_FEEDBACK_TRACEABILITY.md) for the
  user's concrete critiques and MoneyInMotion constraints. Record applicable UX
  and feedback IDs; inspect sibling flows for the same problem.
- Use [UX_REVIEW_TEMPLATE.md](docs/UX_REVIEW_TEMPLATE.md) for substantial reviews.
  Capture fresh rendered/interaction evidence when making current UX claims.
  Documentation synthesis does not require a new visual audit; label it as such.
- Distinguish implemented, verified, partial, blocked, and deferred work. Passing
  tests or old screenshots do not establish full usability or accessibility.
- Update affected behavior docs, review evidence, and regression tests together.
  Keep past verification dates/results intact and refine the guide when feedback
  exposes a gap. Do not duplicate the canonical principle/proposal lists.

## Data and operational boundaries

- This UX phase remains schema-free. Proposed history journals, rule metadata,
  currencies, and durable manual matching require separate user review before
  implementation; see the proposal register in `docs/UX_LIFECYCLE_REVIEW.md`.
- Application settings come from `~/.moneyinmotion/config.json`; account configs
  live only at `Statements/<account>/AccountConfig.json`. Do not reintroduce
  environment overrides or recursive account-config discovery.
- Preserve imported facts. Use synthetic data or isolated copies for writes.
  `/mnt/d/Dropbox/MoneyAI/` is strictly read-only. Keep financial screenshots and
  private data out of Git and external services.
- Follow [CONTRIBUTING.md](CONTRIBUTING.md) and
  [testing-and-verification.md](docs/testing-and-verification.md) for validation.
  For documentation-only work, check formatting and local links; do not invent
  a new application/browser verification result.
- Commit, push, deploy, or publish only when authorized for the current task.
