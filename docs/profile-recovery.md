# Recovering profiles and PFPs

Implemented November 5, 2026:

- Extracted 25 distinct wallet-linked profiles from preserved Sound homepage/playlist Next.js data; 23 had avatar URLs, and all 23 image files were recovered to `public/collectors/` after validating image signatures. Original CDN responses used a non-image content type despite containing actual PNG/JPEG files.
- Preserve captured name, wallet, original profile URL, avatar source URL, capture date, retrieval time, and source page in `data/historical-profiles.json`.
- Prefer a preserved historical Sound avatar. Otherwise resolve an ENS primary name and explicitly verify its forward address matches the wallet. Use the configured ENS avatar through the ENS metadata service; never choose a random NFT from holdings.
- ENS resolution failures remain retryable and do not remove archived identity. Placeholder initials are visibly distinct from recovered images.
- Collector profiles show wallet, identity evidence, historical captured comments, and recordings observed in loaded holder pages. They are not complete collection scans.
- Factory-identified Sound release contracts automatically show current indexed holders on release pages. Shared/unknown contracts show only the referenced ERC721 token's current owner. Full historical mint ownership and shared-contract release grouping remain unfinished. Factory registry rejects unknown version/factory combinations and legacy artist-contract factories.

## Filling remaining artist portraits

`data/pfp-recovery-queue.json` contains 180 artist/collaborator identities with recordings but no sourced local portrait. This includes collaborators, not only headline artists. Each entry includes existing sources and release URLs where known.

Order of work:
1. Recover archived Sound artist pages by exact release handle and wallet association. Preserve image URL/capture date and cache valid bytes.
2. Use existing sourced portraits from the NFT Era project.
3. Check artist-owned websites, linked social profiles, and official press kits. Label present-day portraits separately from historical Sound PFPs.
4. Resolve ENS avatars only after independently establishing the artist wallet. A collector wallet is not evidence of artist identity.
5. Allow an authenticated artist/collector to choose a present-day profile image after Music Nerd account integration; preserve historical images as separate evidence.

No name-only identity merges, arbitrary NFT selection, generated portraits, or inferred historical dates.

Reference: https://docs.ens.domains/web/reverse/ and https://metadata.ens.domains/docs


## Expanded pass

36 monthly homepage captures now supply 1,370 wallet-linked profiles, with 772 original profile images preserved locally. Sources and capture dates remain per wallet. The profile extractor covers both user objects and flattened comment-owner fields. Some images are unavailable; current verified ENS can supplement these without inventing a chosen wallet PFP.

Early Apollo-cache Artist, User, and Media references are resolved by `scripts/recover-archived-artists.mjs`. This recovers 161 artist identities and 60 historical Twitter links; matching uses the exact Sound handle in token metadata plus the artist name.
