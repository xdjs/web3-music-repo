# Music Nerd Lab submission — prepared November 6, 2026

Status: **published and verified**, November 6 at 09:57 UTC. Pete explicitly requested adding the deployed project to Lab under Pete Rango. Public listing: https://lab.musicnerd.net/peterango/music-nft-recovery .

## Confirmed publishing path

The live [Lab API documentation](https://lab.musicnerd.net/recipe-api.md) specifies `PUT https://lab.musicnerd.net/api/recipes`. This is the current recipe/app submission path; `/api/protocols` remains a compatibility alias. A successful write creates or updates an external experience in Lab, together with its cookbook and starter recipe.

The API accepts a dedicated creator-scoped publishing key, not a Supabase service-role credential. Creator identity is determined by that key; do not send `creator` or `owner_id` in the payload. A read-only verification found that the existing local publishing key matches an active database registration for creator `peterango`, whose public name is **Pete Rango**. The earlier key-mismatch note is not the current state.

The intended ID `music-nft-recovery` is unused. `music-nft-era` already belongs to the separate documentary and must remain unchanged. Reusing the recovery ID makes retries idempotent.

## Prepared listing

- Name: **Music NFT Recovery**.
- Description: Listen to recovered music NFTs, find artists and collaborators, explore collectors, and make playlists from across the music NFT era.
- Category: Artifacts.
- Launch mode: external; no camera or microphone permissions.
- Source: https://github.com/xdjs/web3-music-repo/tree/codex/recovery-app .
- Cover: actual 1440×900 rendered homepage screenshot, `public/lab-cover.png`, to be served from the verified deployment.
- Cookbook: explains listening features, token/metadata provenance, the actual recovery process, original versus estimated musical metadata, and incomplete coverage.
- Starter recipe: a short adaptable prompt asking one question at a time, beginning with the artists or collections to preserve.

The full prepared payload and submission helper are under ignored `work/lab-submission/`. The helper validates the complete payload using Lab's current `protocolInput` schema. A dry run validated all text fields and limits with a placeholder origin; that is not a deployed URL check or a publication.

## Publish and verify

1. Confirm the recovery HTTPS origin is deployed and publicly accessible, and its `/lab-cover.png` serves the screenshot.
2. Prepare the final payload with that exact origin. Review all fields, then run the helper with `--publish` only after the orchestrator's go-ahead.
3. Submit to `/api/recipes` using the existing Pete-scoped publishing key. The helper loads the key privately and does not print it or include it in source control. It refuses redirects when transmitting authorization.
4. Require HTTP 200 with `id=music-nft-recovery`, `creator=peterango`, `status=published`.
5. Read back the persisted record, including exact deployment URL, image, source, and text.
6. Open `https://lab.musicnerd.net/peterango/music-nft-recovery` in a browser. Verify title, Pete Rango attribution, cover, launch destination, cookbook, and starter recipe actually render. An API success alone does not prove public rendering.

No Lab application source, schema, existing listing, publishing key registration, or production database record was changed during preparation. The existing key is shared with prior authorized publishing work; do not revoke it automatically as if it were a new disposable key.

## Publication result

Submitted through `PUT /api/recipes` after production browser QA passed for deployment `dpl_EvGcZJyofBcXUXehfhyNQXZxGckt` (source `4a21953`). API returned HTTP 200, creator `peterango`, status `published`. Read-only database verification confirmed exact launch URL, screenshot, source, cookbook, starter recipe and external mode. The separate `music-nft-era` entry retained its prior URL and update timestamp.

Public rendered page verified at 1440 and 390px: title, Pete Rango attribution, explicit originator credit, loaded original app screenshot, correct launch destination, expanded cookbook, and starter recipe. Lab's page measures 392px document width at a 390px viewport; the 2px overflow is a Lab layout limitation, not a recovery app change. No Lab source was modified. Evidence: `data/lab-submission-verification.json`, `captures/lab-listing-*.png`.
