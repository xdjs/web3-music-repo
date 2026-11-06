# Music NFT Recovery on Music Nerd Lab

Status: **published, updated, and independently verified** on November 6, 2026 at 10:38 UTC. Pete explicitly authorized the original submission and the later update after merging to main.

Public listing: https://lab.musicnerd.net/peterango/music-nft-recovery .

## Current published listing

- ID: `music-nft-recovery`; creator: `peterango` / **Pete Rango**. The existing listing was updated; no duplicate was created.
- Name: **Music NFT Recovery**.
- Launch: https://web3-music-repo.vercel.app/ .
- Source: https://github.com/xdjs/web3-music-repo/tree/main .
- Cover: https://web3-music-repo.vercel.app/lab-cover-v2.png — the approved 1200×630 Music Nerd cover, matching the deployment's social image.
- Category: Artifacts. External launch mode; no camera or microphone permissions.
- Cookbook: explicit “Originated by Pete Rango” credit, the documentary-to-contract recovery process, current listening/lyrics/playlist/account features, Supercollector and Spinamp recovery, source distinctions, and incomplete coverage. It makes no complete-discography or lifetime-income claim.
- Starter recipe: a short adaptable prompt, beginning with the artists or collections to preserve. It remains distinct from the project's actual creation narrative.

## API and persistence verification

Updated through `PUT https://lab.musicnerd.net/api/recipes` using the existing creator-scoped publishing key. The [public API documentation](https://lab.musicnerd.net/recipe-api.md) documents this route; `/api/protocols` is a compatibility alias. Creator identity comes from the key; the payload does not supply `creator` or `owner_id`. No key was printed, committed, rotated, or revoked.

The API returned HTTP200 with `id=music-nft-recovery`, `creator=peterango`, `status=published`, and `updated_at=2026-11-06T10:37:42.600764+00:00`. An independent read-only database SELECT confirmed the exact launch URL, new cover, main source URL, category, external mode, status, and explicit originator credit. Stored cookbook and starter-recipe hashes match the submitted text.

The separate `music-nft-era` documentary retains its original URL, cover, source, and update timestamp `2026-11-05T23:54:12.202521+00:00`. No Lab source or schema was changed. The ignored `work/lab-submission/` folder contains the payload and submission helper; credentials remain outside source control.

## Rendered and deployment verification

Updated only after production deployment `dpl_EzRjTGwjs26ny3bDyrUvDJnF1uEr` from merged main commit `e3458a1e29ff581dded2a90c0c6b19e454fa5548` passed the real live catalog, lyrics, artist portrait, login-modal, shared-playlist and audio checks.

The public Lab page was then opened and visually inspected at 1440 and 390px. Its new cover loads, the launch button targets the live recovery app, the source link targets main, and the expanded cookbook, originator credit, and starter recipe render correctly. Lab's existing page measures 392px document width at a 390px viewport; that minor Lab layout issue was not changed as part of this recovery app update.

Evidence: `data/lab-update-persistence.json`, `data/lab-submission-verification.json`, and `captures/lab-listing-{1440,390}.png`. The first publication at 09:57 UTC used the prior homepage screenshot and recovery branch; this update supersedes those listing fields.
