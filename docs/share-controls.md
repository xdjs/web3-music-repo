# Share controls

Song and artist pages expose a Share button using the existing outline-button style. Recovered playlists reuse their existing Share action; it now shares the attributed historical playlist route instead of a detached snapshot. Personal playlists retain their existing snapshot sharing action.

Song, artist and recovered-playlist controls call the shared `shareEntity` helper. Native sharing is preferred where supported; otherwise the link is copied. Cancellation is silent. If neither native sharing nor clipboard access succeeds, a native dialog displays a selectable link with the same form, typography and controls already used by playlist sharing. Sharing does not route away, change the listening queue, or call a playback action.

`scripts/verify-entity-share-ui.mjs` verifies actual clipboard contents for all three entity types at 1440px and 390px, including exact canonical URLs and unchanged routes. It also exercises native-share success/cancellation with controlled browser stubs and a denied-clipboard manual fallback. `data/entity-share-ui-verification.json` records the result; `captures/share-*` cover desktop/mobile light and dark. Song artwork and the Pete Rango profile image loaded; recovered-playlist collage storage was still pending in these captures and is not implied to be recovered by this UI change. Ten relevant playlist/historical/playback tests passed. Server-rendered preview metadata and social crawler behavior are verified separately by the share-route implementation.

## Corrected Planet X playback provenance

The song Provenance view shows an artist-supplied corrected-playback notice when the exact record has an approved override. It identifies the approving artist/date and explicitly preserves the original NFT media reference below. The notice does not claim the replacement file is the original NFT CID. Transient playback labels identify artist-supplied playback when its source flag is present; there is no added at-rest player label.
