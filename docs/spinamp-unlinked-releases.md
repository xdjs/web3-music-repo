# Recovering indexed releases whose mint link is unconfirmed

Baseline: `8771478`, 37,345 admitted recordings. This work is isolated on `fix/spinamp-missing-links`; it does not change the canonical catalog or deploy anything.

## What the missing-link audit established

The frozen 52,987-track Spinamp inventory includes **13,515** exclusions labelled `no-indexed-nft`: 8,379 Sound, 4,313 Zora, 464 NOIZD, 357 Spinamp and two Nina. This is a separate group from the 42 unresolved/error references. All 13,515 have indexed audio URLs/IPFS references, artist IDs, names, titles and source pages.

The original resolver stored `compact(nodes[0]?.nftByNftId)`, which turns both an empty page and a missing first nested NFT into `null`. It did reject reported GraphQL errors, but did not retain raw responses or distinguish those two cases. Successful cached nulls are intentionally skipped by `needsRelationRetry`; later retries therefore did not revisit this group. Only 245 null entries retain a zero-count value; the other 13,270 have no retained count. That gap is **not proof that 13,270 responses were false negatives**.

Six fresh representative queries (one each Sound, Zora, NOIZD and Spinamp; both Nina) returned valid empty pages with `hasNextPage:false`, no errors. Six additional reverse probes, each checking exact candidate NFT primary keys 0/1/2 across sampled Sound/Spinamp contracts, found no indexed NFTs. These bounded probes recovered no new exact NFT links. They establish the observed index responses only: they do not establish that the releases were never minted, or that all editions/chains were searched. Raw queries/responses are preserved in `data/spinamp/missing-link-probe.json` and `missing-link-reverse-probe.json`.

## Listening-only candidate

The separate candidate has **13,288 releases**, potentially bringing listening coverage to **50,633** records while retaining the existing 37,345 unchanged:

| Platform | Candidate recordings |
| -------- | -------------------: |
| Sound    |                8,258 |
| Zora     |                4,222 |
| NOIZD    |                  461 |
| Spinamp  |                  346 |
| Nina     |                    1 |

The 13,515 inputs reconcile to 13,288 candidates, 219 duplicates and eight holds. Duplicates require an exact processed-track identity or **the same exact indexed artist ID and preserved media reference**: 80 match the existing catalog and 139 are duplicates within the candidate. Display names are never identity keys. Seven holds have audio references equal to artwork; one is a decoded video whose bounded checks did not confirm audio. **5,369 candidate durations remain unknown.** There is no whole-catalog playback-availability claim.

Each record uses the existing deterministic `spinamp-<SHA256(trackId)[0:20]>` ID, so a later confirmed NFT link can upgrade the same identity. It carries `assetType:"indexed-release"`, `mintStatus:"unconfirmed"`, exact `spinampTrackId`/`spinampArtistId`, a source page, and explicit processed audio provenance. It omits `chainId`, `contract`, `tokenId`, `mint` and `standard`. `indexedNetwork` is display-only; `indexedSourceDate.kind:"index-record-created"` is an index date, not a release/mint date. Public portraits use exact indexed artist IDs; Pete Rango's existing mapping remains scoped to his exact known wallet. No new Pete records are claimed from this cohort.

`bundle.evidence[id]` uses `sourceType:"spinamp-track-index"`, `mediaSourceType:"spinamp-preserved-audio"`, `onchainVerified:false`, and null original NFT metadata/media pointers. These are existing indexed audio copies; no new transcodes were created. One additional explicit indexed audio reference may be retained as `preservedMediaAlternatives`, but the current player does not automatically try that separate representation. All six positive samples below played through the primary URL.

**Admission requires the separate UI/model capability changes**: missing asset keys must not collapse distinct releases; no token/contract explorer, NFT recovery, collector, owner or revenue claims can be made for these records. The isolated UI agent owns these guards. This builder alone does not change application behavior.

## Actual bounded media checks

Eight stratified samples were tested in native Chromium, including known and unknown duration examples across the five platforms, with at most two source/gateway attempts each. Six showed advancing playback and decoded audio:

- Sound: `spinamp-4130ab5f9ba118dd8bca`, “express yourself”.
- Zora: `spinamp-3d0fac554ccb97331ded`, “Bivan9do”; actual 568×320 video with audio, now classified as video by this exact observation.
- NOIZD: `spinamp-66e7d6a196ca36f3f447`, “Legit Ft. ChimiChanga”, and `spinamp-f9194c7d4cb1eef96439`, “With Me”.
- Spinamp: `spinamp-196404e062c8b859de0f`, “Rear View”.
- Nina: `spinamp-5bd01172d818633540af`, “God's Mom - S/T”.

“Iron Beats” loaded/decoded audio in the original attempts but did not satisfy the advancing-clock assertion; it remains availability-unverified. “Sylvanian Families’ Castle Nature Invasion” loaded a 16-second video with no decoded audio in two attempts; it is held for media review, **not declared definitively silent or nonmusical**. A further bounded diagnostic hit a cross-origin `captureStream` restriction and was stopped without further requests. The diagnostic error and limited first result are preserved in a clearly labelled derived receipt.

`data/spinamp/unlinked-release-media-verification.json` records the original tested candidate hash, source IDs/URIs and exact observations. Applying its six positive observations and one hold produces the final candidate; no unrelated media-kind change is inferred. Startup checks are not complete-track auditions or media fidelity measurements. Mobile/browser-wide availability is not established by this Chromium sample.

## Reproduction and evidence

- `data/spinamp/unlinked-release-inputs.json.gz`: portable derived public snapshot (original missing-link track rows, public portrait references, exact existing processed-media assertions and frozen inventory hash). It contains no account credentials or private profile data. It is not claimed to be a raw GraphQL envelope.
- `data/spinamp/unlinked-release-audit.json.gz`: every duplicate/hold and its reason.
- `data/spinamp/unlinked-release-summary.json`: final counts and bytes.
- `scripts/spinamp-import-unlinked-releases.mjs`: regenerate from portable inputs; defaults to ignored `work/spinamp-unlinked-candidate`, never the deployed dataset. `--prepare` refreshes portable inputs only when the frozen full local inventory/reference/profile caches are present.
- `src/spinamp-unlinked-release.mjs`: exact-source builder, observation guard and baseline exclusion for idempotent regeneration after admission.
- `scripts/verify-spinamp-unlinked-media.mjs`: bounded native-media verifier; no account or chain writes.

```sh
node scripts/spinamp-import-unlinked-releases.mjs
node --test tests/spinamp-unlinked-release.test.mjs
```

Eight focused tests cover absent NFT identities, provisional unknown-duration media, artwork/unsafe-source holds, name-safe and exact-media deduplication, the exact Pete mapping, portable evidence/counts, regeneration after admission, and exact media observation bindings. The portable candidate remains separate from the published catalog until integration and actual rendered UI checks pass.
