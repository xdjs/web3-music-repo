# Stories video export — next implementation

Status: **planned, not implemented**. The collector/account checkpoint takes priority. The already shipped song/artist/playlist links remain available. No listening sources or playback copies should be generated or replaced for this feature.

## First usable result

A separate **Create Story clip** action should produce a genuine, ready-to-upload MP4: 1080×1920, H.264 video, AAC audio, 15-second excerpt initially. The listener chooses a start time, previews the clip and then downloads it or opens the OS file-share sheet. The file contains the actual selected music excerpt and original cover art, artist/title, Music Nerd lenses and existing pink/dark typography treatment. Keep the core artwork/title away from the top/bottom app overlays. Use the current record page and `public/social/music-nft-recovery.html` as references; inspect the rendered export before shipping. A URL can be printed on the artwork, but an MP4 cannot supply a clickable Instagram link sticker.

An export must retain its selected playback source attribution: original source, separately indexed preserved copy, or explicit artist-supplied correction. Never label a preserved copy original or silently substitute another song. Existing approved playback-source selection should supply the source; export provenance belongs in a separate manifest.

## Recommended bounded architecture

1. A record dialog collects a start time and fixed 15-second duration. Render/preview is explicit; do not auto-post or request an Instagram login.
2. A request supplies only record ID, start and duration. The server resolves the known catalog source and artwork. It must not accept arbitrary remote URLs, executable filter expressions, markup or output paths.
3. Generate one cached artifact per source identity + artwork + excerpt + renderer version. A renderer reads bounded downloaded inputs, produces the branded still frame plus audio excerpt, and validates the output with ffprobe. Keep render concurrency and per-user requests bounded; failed source fetches are retryable failures, not blank/silent successful exports.
4. Return a storage URL/status, not the MP4 as a Vercel Function response. Vercel documents a 4.5MB response-body ceiling, and the current function bundle already contains catalog data. A dedicated renderer with a deliberately small dependency bundle is preferable to adding ffmpeg plus headless Chromium to the existing catalog handler. Confirm configured duration, binary availability and storage before implementation; no new paid service was provisioned in this research.
5. Once the actual file is ready, a second user click invokes `navigator.canShare({files})` / `navigator.share({files})`. Offer an MP4 download if file sharing is unsupported, blocked by embedding, or cancelled. Never rename WebM bytes to `.mp4`.

Fetch inputs with HTTPS host/redirect checks, public-address checks, time/byte limits, and exact catalog identity. Run ffmpeg on downloaded files with network protocols disabled; do not allow ffmpeg to chase arbitrary redirects or embedded remote references. Large or unreachable inputs should clearly report that this excerpt cannot currently be exported. Rendering every catalog entry in advance is out of scope.

## Why browser-only cannot be promised across the catalog

Native MediaRecorder must be feature-tested with `isTypeSupported` for the actual MP4 codec combination; even supported recording can fail for resource reasons. Browser canvas/audio capture also requires valid cross-origin access to the source. A song that plays in a normal media element can still be unavailable to canvas or Web Audio export. Drawing an image without CORS approval taints the canvas and blocks its export. A browser path could be an optional optimization for suitable sources; it cannot be presented as reliable coverage of all archived gateways.

Web Share targets are selected by the OS. A website cannot guarantee that Instagram Stories appears, nor confirm that a user posted the result. File sharing requires a fresh user gesture, so do not call it automatically after a long render finishes. Meta's native Sharing to Stories documentation remained unavailable (HTTP429 on the current URL and fetch failure on its legacy URL) during this check; no native bridge or direct-to-Stories promise is justified by this research.

## Acceptance checks before calling this shipped

- Inspect the actual MP4 container/codecs/duration/dimensions; decode and audition the selected excerpt, checking that no other active player audio was mixed in.
- Preview the exported file on desktop plus a physical iOS/Android device and actually upload a sample Story manually; automation of a download alone does not establish Instagram acceptance.
- Verify title/artwork clipping and branding with long titles, diacritics, dark/light page entry points and missing artwork.
- Exercise source failure, CORS failure (if a browser path exists), timeout/cancel, unsupported sharing, byte-limit rejection and stale navigation. Keep ordinary playback unchanged.
- Test preserved-copy and artist-corrected sources with accurate provenance; keep original source links accessible.

## Primary references checked November 6, 2026

- [Web Share API](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share): file support, transient user activation, permission policy and OS-dependent targets.
- [MediaRecorder codec capability check](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static): capability is queried per MIME type and recording can still fail.
- [Canvas cross-origin rules](https://developer.mozilla.org/en-US/docs/Web/HTML/How_to/CORS_enabled_image): CORS and tainted-canvas restrictions.
- [Vercel Function limits](https://vercel.com/docs/functions/limitations): payload and deployment constraints; verify the actual project configuration before choosing a render host.
- [Meta Sharing to Stories](https://developers.facebook.com/docs/instagram-platform/sharing-to-stories/): requested but returned HTTP429; no requirements inferred from the unavailable page.
