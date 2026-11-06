# Entity-specific public share previews

Share links now reach server-rendered pages, so crawlers receive metadata without executing the app or reading a URL fragment:

- `/share/record/:id` → `/#record/:id`
- `/share/artist/:id` → `/#artist/:id`
- `/share/playlist/:id` → `/#historic-playlists/:id`
- `/share/mix/:token` → `/#shared-playlist/:token`

Each successful page returns HTTP200 with Open Graph and Twitter title, description and image. Records use their artwork, artists use an existing portrait, recovered playlists use preserved track artwork, and personal snapshots use the first matched recording’s artwork. Missing images fall back to the existing Music NFT Recovery cover. No image proxy or arbitrary remote fetch is introduced. JavaScript takes the visitor to the exact app fragment; a visible link works without JavaScript. Opening a share does not autoplay audio.

Unknown entities, malformed paths and invalid/oversized compressed snapshots return404. Text and attributes are escaped. Personal snapshots retain only the existing public name/record-ID shape; account identifiers and private playlist storage are not fetched. Entity pages use public caching; mix snapshots use `no-store` and `noindex`. Production canonical origin is configured or the fixed app origin; only explicit loopback development hosts can override it. Vercel rewrites `/share/:path*` to the function before API rules. Existing large hash snapshots remain decodable; new public URL creation uses its separate conservative URL-size guard.

`data/share-pages-verification.json` records actual handler checks for all four metadata pages, all four browser destinations without autoplay, unknown404 and HEAD behavior, plus four no-JavaScript landing captures at1440/390 in light/dark. All four rendered captures were inspected against the app’s existing record-header styles; no new visual system was added. Seven share unit tests cover entity selection, artwork, identity, escaping, bounds and private-field exclusion. Actual third-party social-card caches have not been refreshed or independently verified; their eventual rendering and caching remain provider-controlled.

## Local artist-master video serving

Local public `.mp4` files stream as `video/mp4` with HEAD and single byte-range support, including suffix/open ranges and correct416 responses. This enables seeking without buffering the entire file in Node memory. Vercel continues serving the deployed MP4 as a static asset. The actual corrected Planet X asset returned206 for bytes0–31 of29,304,810, with bytes matching the file. Two unit/HTTP tests cover parsing and response semantics.
