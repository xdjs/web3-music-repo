# Public holdings as a recovery index

The November 6, 2026 public OpenSea scan for p3t3rango retrieved 412 unique visible tokens over nine pages ending with a null pagination cursor. The page counter displayed 413, so neither exact account completeness nor hidden holdings coverage is claimed. See `data/pete-recovery/opensea-holdings.json` for the captured item data and `opensea-discovery-audit.json` for compact source references and catalog comparisons.

At the comparison snapshot, 30 exact selected tokens matched our catalog, 161 tokens shared a contract with a catalog record, and 92 tokens on absent contracts had indexer URLs ending in audio/video extensions. Different editions of existing songs explain some token mismatches. A media extension does not prove music; videos, passes and art must be verified before import. Holding a recording does not establish creator or collaborator attribution.

Two priority works are now verified and proposed for import: Evermore DEMO Tape REIN X Pete Rango and Mavi Taylor's Say it celly. Three Polygon Isolate art/video tokens have no independent music-credit verification and remain leads. The separate OpenSea collection label Planet-X- points to the same already recovered Ethereum Planet X contract, not another song.

## Base leads for the next bounded pass

These exact absent-contract references were found in the user's public holdings. They resemble Sound-era releases, but factory/frontend platform provenance has not been independently established by this task:

| Indexed release | Contract | Selected token |
| --- | --- | --- |
| Cherele — HOOTY HOO | `0x65b62efd85e8ec56e44a682861d4639947cf5fd6` | 20 |
| Mavi Taylor — Sanctuary | `0xbfd94993d20c532da7fa31f955a55ef8b763175d` | 4 |
| Kevin George — Paranoid (w/TK) | `0x79111d917b66f480d20686b4bbded8a1f4a2a014` | 31 |
| Kaien Cruz — Villain (w/TK) | `0xcc91a79eb4b648cfb83c6438fc96bf9f785c12ae` | 31 |
| Sara Phillips — Imagine (w/TK) | `0x0e8fa3229d535a2b2d8f9eaeec550dd74c4afef1` | 46 |
| Domino — Pressure (w/TK) | `0xf15fd6b0bb8794b2d6e2b52b13d54969798c2402` | 6 |

Next: read fixed-block tokenURI/supportsInterface for these specific pairs; inspect original metadata; verify actual media decoding; retrieve deployment transaction/factory event where public access permits. Do not redo the entire 9,000-contract census. Direct Base Blockscout API returned HTTP403 for the first contract during this session, and the Basescan page was unavailable to the web reader; these failures are provider limitations, not proof that contracts or media are missing.

The same inventory also supplies exact Zora-chain and Base ERC-1155 references for SCENES visualizers and Songcamp Alumni material. Their artist attribution and per-token media need independent checks. The dataset preserves those leads without adding them to Pete's credits.
