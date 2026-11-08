# Spinamp track metadata overlay — isolated review checkpoint

This proposal is based on main `23dc3fb`; the complete source capture is preserved in parent commit `457f515`. It does not add records or token identities, alter original NFT metadata, or replace media. The published app and canonical data were not modified during preparation.

## What is available

The complete 52,987-track source capture contains 106 validated, immutable GraphQL response pages. Every returned row matches all nine identity/source fields in the frozen inventory. Source and snapshot hashes, exact query, pagination, timestamp, and original scalar values are in `data/spinamp/processed-track-metadata/`. This is an indexed snapshot, not an onchain or all-platform census.

Applying only exact track ID **and** exact artist ID bindings to the 50,633-record catalog yields:

| Addition | Count |
| --- | ---: |
| Direct track/artist matches | 40,808 |
| Records with any enrichment | 22,570 |
| Additional verbatim description versions | 13,273 |
| Previously absent explicitly labeled BPM | 12 |
| Previously absent explicitly labeled key | 1 |
| Supporting-artist track relationships | 7 |
| Distinct supporting artists in those relationships | 1 (Reo Cragun) |
| Selected-URI-bound indexed video classifications | 13,363 |
| New catalog records or inferred token identities | 0 |

Description versions may differ only in formatting. They are not all newly discovered stories or lyrics. The seven artist relationships are the preserved `supportingArtist` relation, not proof of a producer/writer role. Positive `chorusStart` values remain in the raw evidence; this change does not turn them into playback controls or verified musical structure.

## Application boundaries

`src/spinamp-track-enrichment.mjs` validates the record/track/artist tuple and source proof. `musicMetadata`, recovery evidence, artist attribution, original media, chain, token, mint, and playback data remain unchanged. Supporting artists join `personIds` only when exactly one existing person has the matching case-sensitive Spinamp artist ID; no name matching is used.

Additional descriptions appear in a collapsed **Notes preserved by Spinamp** disclosure using the existing `artist-sources` and `original-release-notes` styling. Text and line breaks are verbatim and HTML escaped. These notes do not replace the artist's original description. Existing original musical values and conflicting original values take priority. The strict existing extractor reads only explicitly labeled BPM/key. These source values may replace a displayed audio-analysis estimate, with a Spinamp source label. Estimates that remain displayed retain their estimate marker.

MIME correction is permitted only when the actual selected playback URL/content identity matches the captured processed audio asset. Gateway equivalence is limited to named storage gateways; arbitrary hosts with an `/ipfs/` path are not treated as content-addressed storage. A different selected playback URL, artist-supplied correction, or preserved-copy override is protected. Audio MIME never downgrades existing video. Every new video classification carries `indexedMediaType` source hashes and an explicit **index-asserted; not decoded-media verification** marker. These 13,363 records have not all been watched or listened to.

## Reproducibility and delivery

Run `node scripts/build-spinamp-track-enrichment.mjs` from this worktree. It validates the complete raw capture against its frozen snapshot and builds `data/spinamp/track-enrichment.json`. It deliberately loads the catalog with `{ trackEnrichment: false }`, so regenerating after admission cannot exclude its own data. Repeated generation produced exactly the same SHA-256:

`50193f77d280c84553833fdb181840a55eca4c48ff2a6c38df0fd65f6d7c74cd`

Runtime overlay: 22,979,884 bytes. Full raw capture stays in its subdirectory and is outside the existing Vercel runtime include glob; the root-level runtime overlay is included. Original source pages remain tracked for auditing from a fresh checkout.

Measured production-build catalog sizes:

| Payload | Baseline bytes / gzip | With overlay bytes / gzip |
| --- | ---: | ---: |
| Compact index | 49,112,000 / 8,503,188 | 49,113,885 / 8,505,474 |
| Full export | 176,870,317 / 24,729,267 | 195,782,314 / 28,036,370 |

Descriptions and source proof remain outside the compact first-load catalog; per-record API details expose them when opened. No generated account bundles are included in this change.

## Verification and remaining gate

- Syntax checks passed.
- Focused identity, precedence, escaping, MIME-boundary, original-preservation, source-hash, and index-only regression tests: **32 passed**.
- Full suite: **414 passed / 1 environment failure**. The existing static-video HTTP test could not bind localhost (`listen EPERM`), unrelated to enrichment assertions.
- Production build passed; 50,633 records and 11,226 people preserved.
- All original `musicMetadata`, recovery evidence, selected playback objects, IDs and chain identity fields were compared unchanged across the full catalog.
- **Actual browser layout and representative video decoding are pending.** This agent's localhost listener failed `EPERM`, and the sandbox's disabled escalation policy rejected the approved wrapper request. No alternate bypass was attempted.

Prepared helper: `scripts/verify-spinamp-track-enrichment.mjs`, using `VERIFY_BASE_URL` (default `http://127.0.0.1:4301`). It tests expanded notes, explicit musical facts and source labels, and the exact supporting-artist link at 1440/390px in light/dark themes. It then tries five video samples across Zora, NOIZD, Nina, QuickTime and M4V, with at most two gateways and 20 seconds per attempt. It writes a separate browser receipt and captures. An authorized runner must complete and inspect those checks before merging this UI/MIME proposal. Passing a few examples will not establish whole-catalog media availability.
