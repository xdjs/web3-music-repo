# Now Playing and recording controls

Recording buttons use one state model and the existing Music Nerd SVG icons. Cards, song pages, historical playlist rows, personal/shared playlist rows, wallet cards, and queue entries synchronize with the same media element. The playing recording offers Pause; paused, failed, or ended media offers Play. A pending metadata request can be paused before it resolves. Resuming the current recording leaves its source, time, and queue intact. Distinct duplicate occurrences in the listening queue remain separate Play actions.

Starting or resuming a recording from a page opens the full-screen Now Playing dialog. Clicking Pause stays on the page. The bottom player's artwork and title also open Now Playing. Back and Escape close it without routing or replacing the page underneath, restoring its scroll and focus. Next and automatic advance update the open dialog, but do not reopen a dialog the listener closed. The queue can open above Now Playing and closes independently.

The dialog reuses the existing typography, surfaces, accent, icons, seek control, and transport behavior. It has artwork, title/artist, pause/play, previous/next, shuffle, volume/mute, likes, queue, and a link to song details. One audio element continues playback throughout. The single media element is placed inside the dialog in the initial HTML. Video recordings display that native video in the artwork slot; audio recordings display cover art. No second player or runtime reparenting is introduced. Real Planet X video remained playing across Back with the same source and exactly one media element (`data/now-playing-video-verification.json`).

The Explore subtitle is “Find songs, artists, and collections from the web3 music era”. Artist pages initially render 40 recordings and retain their expanded limit when returning. Details promotes the preserved metadata description, retaining line breaks, and omits editorial `record.note` copy and the duplicate collapsed description. Existing BPM/key badges remain above the original description. Preserved Spinamp audio explains whether the original reference was missing or retained on an unsupported storage host.

## Local verification

20 focused playback-state, queue, and shuffle tests passed. `scripts/verify-playback-controls.mjs` verifies real Mija audio, pause/resume source continuity, mounted-page and scroll preservation, cards and playlist controls, duplicate queue occurrences, queue stacking, Next and native ended behavior. `data/playback-controls-verification.json` records the result. Actual source continuity measured 0.606418 → 0.979710 seconds across pause/resume, without a source reload.

`scripts/verify-playback-edge-states.mjs` injects a delayed metadata response and a media network failure, then verifies real recovered media plays after resuming/retrying. It also verifies decoded shared playlist controls and the Bad Radio original description. These are controlled fault tests, not claims that upstream media currently fails. Evidence is in `data/playback-edge-verification.json`.

Rendered captures `captures/now-playing-{1440,390,320}-{light,dark}.png` were inspected in all six combinations, with loaded artwork and no horizontal overflow. Verification used the local canonical app on port 4191; production must be checked after deployment.

Older browser scripts that click Play and immediately interact with the page underneath must first close `#now-playing-dialog` through its Back control. The modal is intentional; internal Next/ended calls do not auto-open it.

## Planet X overlap report and browser media controls

The user reported hearing delayed overlapping copies around 1:50–2:00 in production; pausing stopped all sound. This remains unresolved. `scripts/verify-playback-overlap.mjs` inspected production with instrumentation covering both DOM and dynamically created/detached media elements. After seeking to 1:48 and playing through 2:00, there was exactly one active media element and one `play()` call, using the original Planet X IPFS video. Pause stopped it. The next-track buffer does not warm while the current work is a video. This bounded check does not establish what the user heard or exclude an effect in the media source; it is not a complete reproduction from the beginning of the song.

Chrome's wrong song title was separately explained by missing MediaSession metadata: its fallback used the underlying page title. The new frontend explicitly sets the active recording's title, artist, artwork, and playback state, and registers native media-control actions. Local verification shows Planet X / Xmane & Pete Rango remains in MediaSession after navigating to NOT4ME. Receipt: `data/playback-overlap-investigation.json`. This fix is on the working branch, not proof of a production fix for the audible overlap.
