# Music NFT Recovery share image

Final asset: `public/social/music-nft-recovery-v1.png` (1200×630 PNG). Identical Lab asset: `public/lab-cover-v2.png`. Small-preview check: `public/social/music-nft-recovery-thumb.png` (400×210). Editable source: `public/social/music-nft-recovery.html`. Re-render with `node scripts/render-share-image.mjs` on the verified macOS environment; the script checks the actual platform font and writes both full-size and thumbnail outputs.

## Current brand reference

This image was designed against the live **https://musicnerd.net/** page on November 6, 2026, plus its currently published OG image, **https://musicnerd.net/social/music-nerd-record-sleeve-v1.png**. That approved OG uses a black background, a hot-pink record sleeve and vinyl, bold white sans typography, and the Music Nerd lenses identity. The new project image keeps that visual family, replaces the generic tagline with a legible Music NFT Recovery title, and explicitly credits Pete Rango.

The live site uses `ui-sans-serif, system-ui, sans-serif` with system emoji fallbacks. Chromium's `CSS.getPlatformFontsForNode` reported **`.SF NS` / `.SFNS-Bold`**, with no custom font loaded. The rendered asset uses that same actual font, not KoHo. Both the current GitHub `main` source and the live font inspection were checked: KoHo declarations still exist for older helper classes, but they do not supply the live homepage heading font. The older local MusicNerdWeb working copy has unrelated changes and was not modified.

The original lenses logo was downloaded unchanged from **https://musicnerd.net/musicNerdLogo.png** into `public/social/music-nerd-lenses-original.png`. Its solid pink is RGB 251, 87, 192 (`#fb57c0`); the sleeve matches that source color. The vinyl and sleeve are deterministic CSS geometry. No artist album art, stock imagery, generated typography, or third-party font download was used.

## Verification

The actual rendered 1200×630 image and 400×210 thumbnail were visually inspected against the approved live OG. The project title and lenses mark remain legible in the small version. The full image uses the live system font, has no clipped title, no missing logo and no external runtime dependencies. The PNG is self-contained and does not depend on a recipient having the font. Re-rendering checks the local system-font environment so another OS cannot silently substitute its default font.

`public/social/share-image-provenance.json` records reference URLs, rendering dimensions, actual platform font and render time. The existing generic OG/meta and Lab listing integration are owned by the release orchestrator; this task did not modify archive HTML, server routes or the external Lab listing.
