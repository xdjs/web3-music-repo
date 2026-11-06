# Catalog delivery

The listening app requests `/api/catalog?view=index`. The compact response retains recording identity, token coordinates, artist relationships, search credits, original release links, artwork, playback URLs, historical date sorting, and musical fact badges. Long descriptions, raw recovery evidence, full credits, and payment events are fetched only when someone opens the recording.

`GET /api/record/:id` returns `{ record }` with the same full record shape as the unchanged `/api/catalog` export. An unknown ID returns 404; malformed URL encoding returns 400. Existing recovery workers can continue using the full catalog endpoint.

The local public index is serialized and compressed once per loaded catalog bundle, with an ETag and `max-age=0, must-revalidate`. Changed source-file signatures invalidate the bundle and response cache. Artist presentation groups records once instead of repeatedly scanning the entire catalog. No account or private playlist response uses this public cache.

`buildCatalogPayload(bundle, isIndex)` is exported from `server.mjs` so deployment builds can write the exact same public index and full export as static CDN files. This avoids returning a growing complete catalog through a serverless function body. Per-record details remain a small dynamic response. The Vercel build and rewrite configuration own this static delivery; live verification must check both API-shaped URLs after deployment.

A recording header and playback actions are immediately available from the index. The detail panel displays its existing notice style while loading, times out after 20 seconds, and offers a retry after failure. Requests are deduplicated per ID and successful detail records are reused in memory. A late response cannot replace another route. Updating details preserves the header, selected tab, scroll position, and current audio; playback never starts merely from viewing a record. A newer user-triggered contract read is retained if it completes while details download.

Verification: `node --test tests/catalog-presentation.test.mjs` checks all loaded records for token identity, original playback URLs, musical facts, and identical historical-date order. `scripts/verify-catalog-index.mjs` checks real browser rendering at 1440/390 in light/dark, credits, revenue, provenance, original audio from the compact index, historic playlist matches, plus controlled delayed-response and temporary503 scenarios. Its measured full/index byte sizes are saved in `data/catalog-index-verification.json`; those counts describe that specific checkpoint, not every later discovery import.

Supercollector details distinguish the official public release page from a current token metadata read. The provenance panel shows the checked contract URI template and explicitly flags mismatches while retaining `indexed` status. `scripts/verify-supercollector-ui.mjs` checks the platform filter, source labels, matching-template notice, and mismatched-template notice in the same four views.

## Vercel release delivery

The build exports the same shared `buildCatalogPayload` into `dist/catalog/index.json` and `full.json`. Explicit Vercel rewrites match the `view=index` query first, then the full export, before the dynamic API catch-all. These public snapshots are served as static assets, avoiding the 4.5 MB Function response limit even when a client does not accept compression. Private account and wallet routes are not exported or cached by this mechanism. Recording detail still uses its bounded dynamic endpoint. A new data checkpoint becomes public only after a new deployment.

At the 13,640-record checkpoint: index 11,935,505 bytes /2,413,679 gzip; full 49,264,634 bytes /8,992,625 gzip. The index is approximately 73% smaller compressed; viewing a song adds only that song's full detail. This improves transfer and parsing cost but does not promise immediate playback from every external media gateway.

Live production delivery on November 6: the index used Brotli, 2,285,031 encoded bytes /11,935,505 decoded, 480ms in the measured cached browser request. Both API rewrites matched their static snapshots; the 49,264,634-byte full export returned HTTP 200. See `data/production-final-verification.json`. These are observed request measurements, not a latency guarantee.
