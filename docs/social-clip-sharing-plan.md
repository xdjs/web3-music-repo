# Social clip sharing - next feature

Proposed, not implemented in this release. Keep the normal link-sharing flow already shipped.

A Share clip action would let a listener choose a 15- or 30-second excerpt and a vertical Story or square post. Render original audio with cover art, artist/title, Music Nerd branding and the recording link; preview before sharing. Use on-demand rendering and reuse generated clips, rather than render thousands in advance. Original media must be reachable and suitable for the requested excerpt.

Use navigator.canShare({files}) / navigator.share({files}) where supported; offer an MP4 download otherwise. The OS determines available targets, so a website cannot promise Instagram Stories specifically. A native integration is separate from generic file sharing. Do not auto-post or connect social accounts without an explicit user action.

Spotify's own current integration includes sound-on Story previews and music stickers; it is not proof that the same integration is available to arbitrary websites.

Primary references reviewed November 6, 2026:
- https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share
- https://newsroom.spotify.com/2025-08-21/spotify-takes-instagram-sharing-to-the-next-level-with-audio-previews-and-real-time-listening-notes/
Meta Sharing to Stories documentation returned HTTP429 during this check; verify its current app/platform requirements before implementing a native bridge.
