# Pete Rango: recovered Zora releases

On November 6, 2026, the live p3t3rango Zora created feed exposed five older ERC-721 collections in addition to rush. Reading their token URIs recovered four additional music releases. All four played in Chromium with advancing time and nonzero decoded audio bytes. This is selected-release verification, not complete listening or complete discography coverage.

| Release | Chain | Original media duration | Credits/source |
| --- | --- | --- | --- |
| Dreamvibe | Ethereum | 116.5 seconds | Pete's created feed and contract owner; original description discusses Cas and Elle Symone |
| Planet X | Ethereum | 240.08 seconds | Original metadata: creative direction/production by Xmane and Pete Rango; 3D animation by Nawt Creative |
| Tragg Park | Ethereum | 136.2 seconds | Same explicit original credits |
| Oms at Play | Ethereum | 186.27 seconds | Same explicit original credits |

The three Savage Planet records have distinct audiovisual IPFS assets and 3000×3000 video. Their Zora collection previews exposed only PNG artwork, while tokenURI(1) exposed the real animation_url. This is why collection images alone must not determine whether a contract contains music. All four contracts report ERC-721 support, with Pete's previously established wallet as owner at the captured blocks. Ownership alone was not used for artist attribution: the created feed and explicit metadata provide that context.

`data/pete-recovery/zora-recovered-media.json` contains the four proposed catalog entries and evidence. `zora-original-metadata.json`, `zora-collection-reads.json`, `zora-creator-feed.json`, and `zora-media-verification.json` preserve primary data and verification. The bundle's proposedPeople provides Xmane and Nawt Creative identities; integration must retain the explicit Pete credit despite mergeCatalog's joint-artist grouping.

The fifth collection, Keepers Of Wisdom on Base, has 15 minted tokens. Reading tokenURI for all 15 yielded image-only JSON (plus an unminted token 0 revert). Its collection preview is a video, but no token has an audio/video attachment. It is excluded from this music import. Those reads are saved in keepers-token-reads.json and keepers-metadata.json.

The current Zora profile reports 21 posts while its created feed returns six collection/coin nodes with hasNextPage=false. That mismatch must not be described as complete enumeration of every historical token or every linked wallet. Broader multi-chain wallet discovery, including the user's OpenSea holdings reference, remains a separate task. Holdings can identify missing music but do not establish Pete as its creator.

## Two more recordings from the public holdings inventory

The public OpenSea grid for `p3t3rango` supplied exact references for **Evermore DEMO Tape REIN X Pete Rango** (Ethereum `0xde1553b02fd9f80cc9154b49a3d4fe659b426aa6`, token 2) and **Say it celly** (Ethereum `0x0e616dff8c4d9341ce7cebe3bfa829d76ddb410e`, token 3). Both original token URIs and ERC-721 support were independently read at fixed blocks. Both original IPFS audio files played beyond 0.5 seconds with decoded audio: 185.6 seconds and 141.09 seconds respectively. The six-entry import bundle now includes these two.

Evermore's original title explicitly names REIN X Pete Rango and its description explains their collaboration. It remains labeled Other pending independent minting-platform confirmation; a current Zora feed for the owner's wallet only lists a different contract, so we do not infer Zora provenance for this particular drop. The finished Sound release Evermore is already in the archive as a separate work and was not given demo credits without exact-release evidence.

Say it celly's original description credits Pete Rango as producer and nawtcreative for artwork. The exact contract appears in the official Zora created feed for `mavi_taylor`, reached through its owner wallet; the same wallet resolves to mavitaylor in OpenSea. This supports Mavi Taylor attribution independently of Pete merely holding a token. The current friendly Zora page fails with an Application Error, but the creator feed, chain metadata and original media remain readable.

Primary evidence is in `holdings-priority-reads.json`, `holdings-media-verification.json`, `say-it-creator-zora.json`, `evermore-creator-zora.json`, and `holdings-creator-profiles.json` under `data/pete-recovery`. Original descriptions are retained verbatim in recovered metadata; no holder mentions were converted into production credits.

OpenSea pagination reached its end with **412 unique visible tokens**, while the displayed profile counter said **413**. The mismatch remains explicit. Observed chains: Ethereum 183, Optimism 95, Base 70, Zora 40, Polygon 18, Arbitrum 6. `opensea-discovery-audit.json` records 92 audio/video URL candidates on contracts absent from our catalog. These include real recovery leads and potentially non-musical videos/passes; they are not automatically imported or attributed to Pete. The bounded resumable command is `node scripts/pete-recovery-opensea.mjs`; pass `--refresh` to restart the public query. No login or private holdings were used.

Evermore's `image` field points to a 639,425-byte H.264 QuickTime movie (512×512, 5.6 seconds), so an HTML image element cannot display it. The app cover is the first decoded frame from that exact original asset, saved at `public/recovered/evermore-cover.webp` and visually inspected. The original image URI stays in provenance. Source/frame hashes, extraction method and ffprobe evidence are in `evermore-cover-evidence.json`; no replacement artwork was generated.
