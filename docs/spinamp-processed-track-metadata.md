# Public processed-track metadata checkpoint

A separate capture after the listening-only recovery read all **52,987** frozen Spinamp processed-track identities in **106 sequential 500-row pages / 106 requests**, with zero errors, missing identities or quarantined changes. It finished at 2026-11-08 04:44:08 UTC. The worker exited and released its lock. This checkpoint did not alter the canonical catalog or the current release candidate.

Every returned ID, title, artist ID, platform/internal ID and audio/artwork URL/IPFS reference matched the frozen snapshot exactly. Case is preserved. Source documents are full parsed GraphQL response bodies plus request, timestamp and HTTP status in immutable per-page gzip files; checkpoint hashes cover their JSON serialization, not original HTTP wire bytes. The source-first checkpoint is atomic and resumable. A crash can leave an orphan page which is validated and adopted rather than fetched again. Resumption validates page hashes, cursor order, exact query and snapshot fingerprint. Corrupt state fails closed.

Recovered fields:

| Field                                               |   Coverage |
| --------------------------------------------------- | ---------: |
| Nonempty descriptions                               |     49,987 |
| Description characters                              | 20,955,469 |
| Audio/media MIME supplied                           |     52,987 |
| Video MIME among those processed references         |     19,926 |
| Supporting artist references with matching profiles |         12 |
| Positive indexed chorus-start positions             |     30,742 |

The schema has no direct BPM/key/lyrics fields. Strict existing standalone-label extraction finds explicit BPM in 43 descriptions and key in four; these are not all new facts. No models, prose-number guessing, inferred lyric extraction, role inference or audio analysis were used. A positive `chorusStart` is an index-supplied marker, not independently verified musical structure; zero is retained as source data and not presented as a recovered chorus. `mintStart` was not queried or used as onchain proof.

The snapshot includes records outside the admitted music catalog, including platform exclusions. This is a complete frozen **index** pass, not an all-chain music census or proof every media file plays.

## Offline application candidates — not yet applied

The comparison uses the existing 37,345-record baseline and the reviewed 13,288-record listening-only candidate. It finds 40,808 direct exact processed-track bindings, 22,570 records with at least one proposed addition/correction, and:

- 13,273 additional verbatim description versions (not necessarily semantically new descriptions).
- 12 new explicitly labelled source BPM values and one key, previously absent as supplied values.
- Seven direct supporting-artist relations; producer/writer roles are not established.
- 13,363 provisional audio classifications with a video MIME for the **same selected processed content URI**.

Nothing in `application-candidates.json.gz` is a mutation instruction by itself. Preserve original artist-authored descriptions/metadata and retain conflicting indexed text as a separately attributed version. Musical facts must only fill absent supplied facts, not overwrite conflicting values. Supporting artists require exact identity mapping; no display-name matching. MIME classification must match the selected content reference and remain index-attributed; it must not relabel a different original NFT media URL or imply decoded playback. Browser checks are required before application.

## Files and safeguards

- `data/spinamp/processed-track-metadata-sample.json`: first seven exact-ID public samples and verbatim responses.
- `data/spinamp/processed-track-metadata/identity-snapshot.json.gz`: portable expected identity/media fields from the original frozen inventory.
- `000.json.gz` through `105.json.gz`: complete public response receipts.
- `checkpoint.json` and `summary.json`: final status, manifest hashes, counts and failures.
- `application-candidates.json.gz` and `application-summary.json`: offline proposals, source-page/row hashes and baseline fingerprints.
- `scripts/recover-spinamp-track-metadata.mjs`: one writer lock; 30-second request deadline; eight-MB response budget; at most 106 pages and 109 attempts per campaign; three consecutive provider/validation failures stop; failure receipts retained; no hidden empty-success conversion.
- `scripts/report-spinamp-track-metadata.mjs`: reproducible offline comparison using portable inputs, with no application writes.

Five focused tests verify scalar types, exact artist/media bindings, source changes quarantined, supporting-artist foreign keys, pagination/provider failures, and every raw page/hash/cursor through the complete frozen cohort. Current catalog/production changes require a separate reviewed overlay.
