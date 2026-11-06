# Remembered filter browser verification

Verified on the canonical local app at `http://127.0.0.1:4191` on November 6, 2026 with Chromium: 1440 × 1000 dark and 390 × 844 light. The actual app, catalog, filter controls, localStorage, routing and reload behavior were exercised. Public collector/profile and wallet API responses were deterministic fixtures using three actual catalog record IDs and distinct synthetic token identities. This is not a live ownership or signed-in account verification.

`scripts/verify-filter-preferences.mjs` checks:

- Explore platform, network, media, collection and sort survive page reload.
- Collection preferences independently survive reload with different collection and sort values.
- Reset removes the relevant preference key, restores defaults after reload and leaves the other scope unchanged.
- Preference JSON contains only its five approved facet fields; search queries, the wallet address and My collection scope are excluded. Search input and My collection scope are blank/off after reload.
- Both viewports have no horizontal overflow or uncaught page errors.

The four `captures/filter-preferences-*` screenshots were visually reviewed against the existing Explore and collected-music controls. They retain the established typography, surfaces, selected chips, native selects and responsive layouts. Long collection names truncate within their selects rather than expanding the page.

The machine-readable receipt is `data/filter-preferences-verification.json`. This verifies local behavior; production deployment, account sync and physical mobile browser behavior are outside this check.

Run from the repository root with `node scripts/verify-filter-preferences.mjs`; optionally set `ARCHIVE_QA_URL` to another app origin. The verifier creates fresh browser contexts and does not write account data or play media.
