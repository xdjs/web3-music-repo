# Stories video export and excerpt editor

Status: **browser-native MP4 export verified on production; physical-phone Instagram upload remains unverified**. Deployment `dpl_BVPeEaag2g8PMgcZSyRmyEFneEeu` (`6026373`) produced genuine H.264/AAC MP4s in Chromium and WebKit; see `data/production-story-export-verification.json`. Export feature assertions passed, while its aggregate run retains an unclassified WebKit page error referencing `auth.privy.io`. The draggable excerpt timeline is now deployed at `d0e9e24643f5ce79b485c435bd9ccdf33f627f42`, deployment `dpl_25YuMESWXXwGCsuh4mqNPNZ8uqgG`. Actual production timeline, touch, rapid-preview and resize/theme repaint checks passed in both engines; both generated valid MP4s. See `data/production-story-timeline-layout-verification.json` and `data/production-story-timeline-verification.json`. The latter retains the same unclassified WebKit auth-origin page error as an aggregate failure, separately from passing export assertions. The record page has Create Story clip, start selection, excerpt preview, genuine MP4 generation, download and OS file sharing when supported. No listening sources or playback copies are generated or replaced by this feature.

## Implemented browser path

`src/story-export.mjs` owns a dialog using existing account/playlist dialog surfaces and controls, with dedicated responsive CSS. `src/story-clip.mjs` accepts only an explicitly supported H.264/AAC MP4 MediaRecorder configuration. It loads the selected record’s approved playback URL and original artwork with CORS, time limits and streaming byte caps (32 MiB media, 6 MiB artwork). Unsupported browsers, oversized sources and blocked/unavailable CORS sources receive visible errors; source failures can be retried. No WebM is relabeled as MP4.

A native media decoder reads a bounded Blob; the app does not decode the full recording into a JavaScript PCM buffer. A fresh decoder and isolated Web Audio destination feed only the selected excerpt into canvas capture. The main player pauses on explicit excerpt preview/export/output preview. Export does not connect its audio source to speakers. The resulting MP4 can be previewed before download. Cancel, close, route change, hidden-tab interruption and timeout stop capture and release the media, stream, AudioContext and object URLs. A downloadable JSON manifest records source type, original URI, selected playback URL, start time and record identity. Artist corrections and separately preserved copies remain labeled accordingly.

The first version deliberately excludes source files above 32 MiB; that includes some large WAV files even when ordinary listening works. It does not request a paid renderer or install a server-side transcoder. Native streamed CORS export or a dedicated bounded renderer could extend this later. Both are follow-up work, not current coverage.

Actual Chromium and WebKit tests generated 1080×1920 H.264/AAC stereo MP4 files from Planet X’s approved corrected playback at 100–115 seconds. `ffprobe` validated the codecs, dimensions and approximately 15-second durations; exported-video playback advanced. The native recorder adds small container/encoder padding (the initial runs measured 15.03 seconds and 15.48 seconds). Cancellation worked. Four existing-theme/viewport dialog captures were produced. See `data/story-export-verification.json` and `scripts/verify-story-export.mjs`. Numeric decoded-audio comparison against the exact selected source excerpt exceeded 0.995 correlation in both engines, confirming matching non-silent source audio; physical listening/upload remains a separate user check.

A separate race fixture verifies that a delayed previous record response cannot overwrite the current export metadata, and closing/reopening during rendering prevents stale completion from changing the new dialog. See `data/story-race-verification.json` and `scripts/verify-story-races.mjs`.

Primary codec support references: [WebKit MediaRecorder](https://webkit.org/blog/11353/) explicitly supports MP4 with H.264/AAC and generated Canvas/WebAudio tracks; [Chromium MP4 MediaRecorder intent](https://groups.google.com/a/chromium.org/g/blink-dev/c/p1OMVj1FrMI) describes H.264/AAC MP4 muxing. Runtime feature detection and actual artifact tests are used rather than assuming support from browser names.

The sections below preserve the broader dedicated-renderer proposal and remaining device acceptance checks.

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

## Excerpt timeline refinement (November 6, 2026)

The Story editor now shows a truthful time ruler and a draggable fixed 15-second selection. Its visible width represents the excerpt's proportion of the recording; an invisible target of at least 44px supports touch without inventing a waveform. Clicking the ruler selects a moment, dragging preserves the grab offset, and keyboard arrows/Home/End move the selection. Exact seconds remain available in a collapsed disclosure.

Play/Pause auditions the selected excerpt and a separate position slider seeks within those 15 seconds. Moving an actively playing selection pauses during the drag and resumes its new excerpt on release; keyboard adjustments stop audition. Preview progress and start/end times remain visible. Selection changes invalidate an earlier export, and generation guards prevent stale seeks from restarting an obsolete preview. No full PCM decode, new backend, playback transcode, or social auto-post was added.

Actual Chromium and WebKit interaction/export verification is recorded in `data/story-timeline-verification.json`; final responsive/touch-target checks are in `data/story-timeline-layout-verification.json`. The original 32MiB source, CORS, foreground rendering, codec capability and physical-device upload limitations still apply.

A reproducible WebKit preview-paint issue during repeated viewport/theme changes was fixed with a coalesced single repaint when the preview wrapper resizes or the app theme changes. The observers and pending frame are released on close; they skip active MP4 recording. This addresses the visible black preview rather than assuming valid canvas pixels prove a screenshot-only defect. See `data/story-canvas-webkit-diagnosis.json` for the prior observation and post-fix sequence.
