# web3-music-archive on Music Nerd Lab

Status: **rename published and independently verified** on November 6, 2026 at 22:16 UTC. The user requested the exact name `web3-music-archive` for the site and its Lab listing.

Public listing: https://lab.musicnerd.net/peterango/music-nft-recovery . The existing listing ID and URL remain stable.

## Published changes and preserved identity

- Display name: **web3-music-archive**.
- Launch/embedded app: https://web3-music-archive.vercel.app/ .
- Cover: https://web3-music-archive.vercel.app/social/web3-music-archive-v1.png .
- Cookbook/About: updated opening identity and added accurate descriptions of fresh-visit editorial homepage rotation, automatic signed-in playlist synchronization with visible saving/offline/retry states, and public collector search/library filters with separate source scopes.

Only `name`, `url`, `screenshot`, and `about` changed. The description, reusable starter recipe, source URL, tools, category, embedded mode, permissions, published status, creator/ownership fields, and all other stored fields except the update timestamp were independently compared with the immediate pre-publication record and preserved exactly. The cookbook retains **Originated by Pete Rango**. No duplicate listing was created, and the GitHub repository was not renamed: https://github.com/xdjs/web3-music-repo/tree/main .

The preserved embedded mode displays the app instead of a thumbnail hero. The new thumbnail is stored for Lab surfaces that use it. Its public response was verified as a 1200×630 PNG, 95,710 bytes, SHA256 `555665dffa499732810963a28fd9a8c6c9cab48c6e93748e5dd6792638863874`, matching the approved deployed asset.

## Publication and independent read-back

The latest public record was read before preparing the change, then read again immediately before publication. A full-record comparison confirmed no intervening edit. The update used the existing creator-scoped publishing key through `PUT https://lab.musicnerd.net/api/recipes`; no credential was logged or committed. HTTP 200 returned ID `music-nft-recovery`, creator `peterango`, status `published`, and update time `2026-11-06T22:15:33.104955+00:00`.

Fresh unauthenticated public Supabase REST reads independently confirmed every submitted field and equality of all other fields with the pre-publication row. There were no direct database writes, migrations, schema changes, or changes to Lab source code. The Supabase connector did not expose a usable connection identifier, so the read-back used the same public read endpoint as Lab itself; publishing continued through the creator-scoped API.

## Render verification

Actual Lab pages were checked at 1440px and 390px. The renamed title, unchanged recipe, explicit Pete Rango originator credit, expanded cookbook, and new iframe target were verified. Early captures showed the embedded loading shell; these were replaced after a bounded wait for the actual archive homepage heading and featured recording. The final captures show the loaded embedded homepage at both widths. No media was played during this listing verification, and complete remote artwork loading is not asserted.

Lab's existing mobile document remains 392px wide at a 390px viewport, as before this update. No Lab layout changes were made. Account completion, real cross-device playlist writes, and physical-device playback are not established by this listing test.

Evidence: `data/lab-rename-verification.json`, `captures/lab-rename-1440.png`, `captures/lab-rename-390.png`, and `captures/lab-rename-cookbook-1440.png` / `captures/lab-rename-cookbook-390.png`. Public full-row before/after payloads remain in ignored `work/lab-rename/`; the committed receipt contains only the necessary public verification facts.

## Live app release checked before publication

Root confirmed the new origin and cover were live, and the actual new-origin Privy modal returnedHTTP 200, before authorizing the Lab update. The app release is source commit `43704fdc498c290adae1a1a724656f24ee06f188`, deployment `dpl_2VkCTfCs8Mrxji1MKUEbt6rC8H6G`. Independent app tests and their limitations remain in their respective playback, collector, homepage and playlist-sync documents. This Lab rename does not claim whole-catalog playback or a complete blockchain census.

## Prior checkpoints

The previous listing was named Music NFT Recovery and launched `https://web3-music-repo.vercel.app/`. Its cookbook update at 19:46 UTC preserved a separately updated cover and embedded mode. Historical evidence remains in `data/lab-update-persistence.json` and `data/lab-submission-verification.json`.

The embedded account follow-up uses a native new-tab sign-in link before importing Privy inside Lab. Standalone account actions open in the full app; no nested login completion is claimed. See `data/production-embedded-account-verification.json` and `docs/privy-login-status.md` for that separate release.

## Thumbnail brand refresh — November 11, 2026

The existing listing cover now uses `https://web3-music-archive.vercel.app/social/web3-music-archive-v3.png`: exact `#FF75D8` and the supplied 2026 lenses logo. The creator-scoped `PUT /api/protocols` updated only the screenshot; independent public read-back confirmed that only `screenshot` and `updated_at` changed. The creator remains `peterango`, and Pete Rango credit/ownership, title, cookbook, recipe and embedded app are preserved. Actual Lab cover cards were decoded and visually checked at 1440px and 390px, both using the new asset. See `data/release-thumbnail-brand-2026-11-11.json`.
