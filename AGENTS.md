# Notes for coding agents

Read [README.md](README.md) first; its **Goals** section decides trade-offs.
The docs in [docs/](docs/) describe how things work today. They are
explanations to keep accurate, not rules that override the goals. Fix a doc
when it disagrees with the code.

## Data safety

- Live data is whatever `~/.moneyinmotion/config.json` points to (currently
  `E:\data\mim_root\shitals`). **Only the app writes there.** Running the app
  against it is fine, including normal in-app actions the user asked for.
  Never edit its files by hand or from scripts or tests. Experiments that
  write (rebuild comparisons, migrations, edit tests) run on a copy in a
  temporary folder with its own config.
- The user may add or delete statement files under `Statements/` directly and
  then rebuild. Browser upload is only a bulk copy into those folders.
- `D:\Dropbox\MoneyAI\` holds the old C# app's data. It is **strictly
  read-only**, and nothing in this repo reads it any more.
- Never commit statements, snapshots, edits, private config, or screenshots
  with financial values. Tests use small synthetic fixtures.
- Tests and scripts must never touch the real config. On Windows,
  `os.homedir()` reads `USERPROFILE`, not `HOME`.

## Working conventions

- Commit and push often, straight to `master`, once tests and lint pass.
- Before calling work done, run the **Before committing** checks in
  [docs/development.md](docs/development.md#commands). To check the real app,
  start `run.bat` and open the URL it prints (`http://localhost:3001`).
  Don't start a second server on the live data; use a temporary `HOME` and
  `USERPROFILE` and another port for experiments.
- Windows is the primary platform; keep Linux working too (CI runs both).
  Prefer Node scripts over shell-specific scripts.
- Keep docs lean: one place per fact, updated in the same change as the code.
  Don't add dated review logs or process documents; git history is the record.
