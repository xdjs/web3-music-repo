# Sound recovery audit

Recovered raw archived homepage HTML (2023-05-01), Next.js page data, original production JS app and homepage bundles, stylesheet, and build manifest.

Homepage data contains 230 unique comment IDs across five featured releases, including text, songSlot, NFT serial numbers and historical owner profiles. These are a captured subset, not all Sound comments. Slot-to-time semantics need further verification.

Recovered playlist: Chill n Work by Juan Latorre, archived 2023-01-20. See playlist-data.json for declared count, track IDs, ordered release details, audio pointers and addedAt timestamps. Audio playback has not been tested.

Source homepage: https://web.archive.org/web/20230501061119/https://www.sound.xyz/
Source playlist: https://web.archive.org/web/20230120200848/https://www.sound.xyz/playlist/04150d7a-d471-48de-a144-54b00474e59f

32 playlist/comment GraphQL operations extracted to playlist-comment-operations.graphql. Public GET probe to api.sound.xyz/graphql returned HTTP 403; no working backend demonstrated. Original application not yet booted or browser-verified. Bundles may contain obsolete public client configuration; do not reuse embedded service keys.
