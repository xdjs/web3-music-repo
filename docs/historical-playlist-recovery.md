# Historical playlist recovery audit — November 6, 2026

The app initially surfaced one historical playlist, Chill n Work. That was the implemented sample, not the maximum recoverable set. A bounded additional pass recovered three more named, attributed selections. `data/historical-playlists.json` contains all four normalized snapshots; `scripts/export-historical-playlists.mjs` reproduces them from the saved public captures.

| Playlist | Curator | Capture | Track details / preserved IDs |
| --- | --- | --- | --- |
| Chill n Work | Juan Latorre | January 20, 2023 | 23 / 23 |
| STØNED & STÅRVING #5 | STØNEWÅX | June 12, 2023 | 16 / 22 |
| MOMINTS VOL-IV | VoxClub | June 4, 2023 | 14 / 14 |
| Lofi Chill | KOLs Matcha 🍵 | May 20, 2023 | 10 / 10 |

The seven previously unresolved Chill n Work entries were recoverable from its existing raw capture. The original extraction read the first page of release details; the embedded activity feed also contains Release objects tied to the exact missing track IDs. We now join those objects to the preserved ordered ID sequence. This is a recovery/extraction gap we corrected, not proof that those records were unavailable. Full detail recovery does not imply every recording has a unique token match or playable media in the current catalog.

The Wayback CDX query used `www.sound.xyz/playlist/*`, HTTP 200 HTML, URL-key collapse, and **limit 20**. It returned 20 distinct playlist URLs. This is a lower bound from a bounded query, not a total count or completeness claim. We fetched the first three non-Chill 2023 entries from that result and recovered their embedded page data. The CDX response and these three raw captures are saved in `evidence/historical-playlists/`; the original Chill capture is in `evidence/sound-wayback/playlist-data.json`. Each normalized playlist and recovered track retains its exact capture source. No broad crawl or pagination of Sound's former API was attempted.

These ordered curated selections are recovered from Sound's archived web application data (`Shelf`, track IDs, activity feeds and curator profiles). The blockchain token catalog can identify and play associated songs, but it does not by itself reproduce these application-side playlist selections. We have not established an onchain playlist registry, so we should not claim that all historical playlists are reconstructable from token ownership.

For Catalog, the official [catalog-squidward-data](https://github.com/catalogworks/catalog-squidward-data) March 9, 2026 snapshot was inspected locally: **155 Parquet files across 15 schema directories, including 92 public tables**. There is no table with playlist, shelf or collection in its name. `cr_album` represents release album groupings with release contract, token IDs, creator and purchase/payout fields; it is not evidence of user-curated playlists. The published snapshot describes itself as indexed blockchain event history. This absence is limited to that export; it does not establish that Catalog never had playlists or that no other backup/capture preserves them.

Next bounded step: continue the indexed Sound playlist capture list with exact attribution/order and visible missing entries, then check Catalog's archived application pages or any separate application export. Do not label inferred wallet collections as historical curated playlists.

Validation: two tests in `tests/historical-playlists.test.mjs` verify all 23 original Chill IDs, recovery of activity-only entries, exact counts, provenance and the remaining six unresolved entries in STØNED & STÅRVING #5. Playback and catalog identity matching remain separate checks.

All four snapshots are integrated into the local app with direct links, original curator/capture details, recovered-track play/save/share and song likes. Production deployment has not yet been verified for this revision.

Final local verification (`data/historical-playlists-verification.json`) passed all four picker links, direct-link reloads and ordered saved copies in light/dark at 1440px and 390px, without overflow or page errors. Catalog matches: Chill23, STØNED15, MOMINTS13, Lofi10. These totals are not full-track playback checks.
