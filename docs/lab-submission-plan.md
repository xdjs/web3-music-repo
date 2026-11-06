# Music NFT Recovery on Music Nerd Lab

Status: **published cookbook update, independently verified** on November 6, 2026 at 19:48 UTC. Pete authorized updating the existing listing after the new main release.

Public listing: https://lab.musicnerd.net/peterango/music-nft-recovery .

## Preserved listing identity and presentation

- ID `music-nft-recovery`; creator `peterango`, with explicit **Originated by Pete Rango** credit.
- Launch https://web3-music-repo.vercel.app/ ; source https://github.com/xdjs/web3-music-repo/tree/main .
- The current thumbnail is https://raw.githubusercontent.com/xdjs/music-nerd-lab/ae9d01386a15de69c0333d633bd560e15cf883f0/public/social/music-nft-recovery-web-v3.png .
- Category Artifacts, embedded mode, no requested camera/microphone permissions.
- Only cookbook/About changed. Name, description, starter recipe, thumbnail, embedded mode, tools, source, launch URL, permissions and published status were preserved exactly.

An immediate pre-publication read found a separate 19:42 UTC update had changed the thumbnail and embedded mode. The old local draft was corrected to preserve that newer state, and a second read immediately before publication confirmed it had not changed again. No duplicate listing was created.

## Updated cookbook

The cookbook describes the 37,274-entry checkpoint, including 6,054 Nina entries; source-indexed Solana mint identity and unavailable Solana ownership support; song, artist and playlist social links; wallet-matched Explore filtering; contextual queues; source-preserving gateway fallback; separately indexed audio copies; and the distinct artist-supplied correction. It retains incomplete-coverage and sampled-playback limitations. The reusable starter recipe remains unchanged.

## API and independent verification

The update used `PUT https://lab.musicnerd.net/api/recipes` with the existing creator-scoped publishing key. The API returned HTTP 200, `creator=peterango`, `status=published`, and `updated_at=2026-11-06T19:46:38.494244+00:00`. No credential was logged or committed, and no database or Lab source/schema was changed.

An independent read-only SELECT confirmed the new cookbook and exact equality of every non-cookbook field with the immediate pre-publication row. Evidence: `data/lab-update-persistence.json`.

The public cookbook, Pete Rango originator credit, starter recipe and main source link were checked in the browser at 1440 and 390px. The embedded iframe points to the correct live app. The initial captured iframe area was blank, but a bounded follow-up inspection confirmed the recovery homepage and catalog loaded after additional time. Embedded login remains limited: the Privy authentication frame rejected the Lab ancestor under its current `frame-ancestors` policy, and a wallet-provider probe raised a cross-origin `window.ethereum` SecurityError. No auth settings were changed. This verification does **not** establish embedded login or playback; the direct recovery app passed its separate production checks. See `data/lab-embed-inspection.json`. Lab's existing mobile document width is 392px at a 390px viewport; the Lab layout was not changed.

Rendered evidence: `data/lab-submission-verification.json`, `captures/lab-listing-1440.png`, `captures/lab-listing-390.png`. The independently changed thumbnail is verified in persistence; embedded mode displays the app frame instead of the old thumbnail hero.

## Release verified before publication

Deployment `dpl_7uT6F78Wq8syoHRHUMW4BZJHAJia`, main commit `3a79a4d58a7fe16b475991b867fdbb34d7e4910e`, stable URL https://web3-music-repo.vercel.app . Four entity share routes returned specific social metadata and opened their matching app pages without autoplay. All four light/dark 1440/390 share landing captures were visually inspected. CAMPFIRE's local portrait loaded; the corrected Planet X MP4 returned matching byte-range content. Endless and Army of Love both decoded and advanced using their exact verified preserved-copy CIDs. These are bounded samples, not whole-catalog playback certification.

Evidence: `data/production-share-pages-verification.json`, `data/production-preserved-copy-verification.json`, and corresponding production captures. The full frozen-source suite passed 269 tests before deployment.

## Embedded account follow-up

The later account release resolves the unusable nested sign-in path by opening account actions in the full recovery app. In the actual Lab iframe, the recovery app now renders its account card without loading Privy or creating nested auth frames. Its explicit native sign-in link opens a top-level recovery tab, where the real email/wallet modal was verified on production. Lab listing fields and auth origin policies were unchanged. See `data/production-embedded-account-verification.json` and `docs/privy-login-status.md`. Listening remains available inside Lab; account completion was not tested because no OTP or wallet signature was submitted.
