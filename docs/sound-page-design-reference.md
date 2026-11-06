# Historical Sound page organization

Inspected actual Firecrawl screenshot pixels and archived HTML/text on November 5, 2026.

- Artist: https://web.archive.org/web/20230204185752/https://www.sound.xyz/danielallan — `evidence/reference-screens/artist-historical.png`.
- Release: https://web.archive.org/web/20230531114933/https://www.sound.xyz/danielallan/too-close — `evidence/reference-screens/song-historical.png`.

Observed artist structure: full-width photographic banner, overlapping profile image, identity and compact Sounds/Collectors stats, biography, follow control; collector, playlist and activity sections. Dynamic lists failed to hydrate in the archive. This capture does not establish their complete ordering or data. No fake following or historical totals should be used as current counts.

Observed release structure: left navigation; wide dark hero with play/title/artist at left and edition art at right; action controls; Details/Activity tabs; Behind the music narrative; Audience grid with Top/Earliest controls; Rewards; Contract Details table. The recovered screenshot has missing art and placeholder collector widgets; the HTML nevertheless preserves multiple collector profile image URLs and the release story. Colors/spacing here are visual approximations, not extracted CSS specifications.

Implementation: retain Music Nerd navigation/branding and functional playback/playlist actions. Align release hero artwork to the right on desktop, use Behind the music and Audience order, preserve collector/Comments/Provenance tabs as archive-specific additions. Tab switches update only the panel and selected state, preserving the header and scroll position. No fabricated rewards, original mint ordering, counts, or artist-follow functionality.

Still pending: a better-hydrated later artist capture, additional artist banner recovery across the catalog, reliable historical collector chronology, mobile historical screenshots, and remaining artist collector/playlist sections. Daniel Allan’s recovered banner and the banner/identity/stat layout are now implemented and browser-verified on desktop/mobile.
