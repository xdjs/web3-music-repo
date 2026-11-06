# Two exact Spinamp listening copies

The November 6, 2026 streaming check found playable IPFS copies in the cached Spinamp index for **Endless — Sound of Fractures** and **Army of Love — TK**. Each was matched by Optimism chain ID, contract, representative token 1, original metadata URI and the exact original Arweave media transaction. Neither match uses names alone. The original live chain-read evidence stays unchanged.

| Record | Copy CID | Observed media | Browser check |
|---|---|---|---|
| Endless | QmR9U9mrJUvJh4sJwEzSSdGVfNNa6QgNQ1kYhCXaH5KupH | audio/wav, 77,709,362 bytes | Native audio advanced past 1.5s; duration293.686s, readyState4 |
| Army of Love | QmWKSC4HYcVHfjpRDW2JXrSCU96rZwhA513mhpJCKWi7nA | audio/mpeg, 7,828,863 bytes | Native audio advanced past1.5s; duration236.789s, readyState4 |

`data/spinamp/two-processed-copy-verification.json` is the bounded real-browser receipt. `data/spinamp/playback-copies.json` preserves the exact identities, source pointer and selected URLs. `src/preserved-playback-copy.mjs` requires matching token identity, original media and metadata, an allowed IPFS gateway serving the exact indexed CID, and a positive decoded-audio playback result. It never rewrites the original NFT evidence or artist attribution; an approved artist correction has higher priority.

These are **preserved Spinamp copies**, potentially transcoded; byte equality with the originals was not established. Despite the index field name `lossyAudioIpfsHash`, Endless’s copy is a large WAV and is not evidence of compression. This change provides an alternate working source for two known failures, not a catalog-wide encoding or buffering optimization. Startup/advancement was checked, not every second of either recording or all network conditions.

Final local app integration also passed after server restart: both recordings selected their exact IPFS copy on “Listen now,” advanced beyond 1s with readyState4, retained the original Arweave URI in the proof panel, and displayed the separate playback-copy notice at390px without overflow. Receipt: `data/spinamp/playback-copy-app-verification.json`. This is local verification, not a production-deployment assertion.
