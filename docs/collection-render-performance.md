# Collection artwork and update continuity

A bounded production investigation (`data/collector-art-diagnosis.json`) found valid image URLs rather than a missing-art mapping. Eight snapshot covers were requested about 11.9 seconds into the page. The Arweave requests redirected; sampled final responses arrived between 18 and 35 seconds into the page, with others still pending at 42 seconds. These timings describe one run, not an availability guarantee.

The same run exposed avoidable rendering churn: network status/results updates replaced image nodes, and newly inserted wallet matches pushed the visible Spinamp collection out of view. Images removed from the page increased from 40 to 326 during the observed update window. Slow gateways remain a separate limitation.

`src/collection-render.mjs` now reconciles collection result containers and reuses unchanged cards in place. Grids stay connected to the document, retaining native image state and existing same-content fallback state. Identity keys include the wallet/snapshot section, so the same recording in two labeled sections keeps separate controls. Changed metadata or source images replace the corresponding card. Only mounted cards are candidates for reuse; signatures use weak references, with no accumulating detached-card cache.

The update retains the first visible card’s position, accounting for browser-native scroll anchoring instead of overriding it. Filters still restore focus/caret. Query input is handled once rather than triggering another update on blur. Heart and playback controls retain their state.

## Verification

`scripts/verify-collection-render.mjs` uses real app DOM/native cover decoding and delayed public-index fixtures. At 1440px and 390px, insertion of 20 upstream records retained the same card and 1500px image, with exactly one artwork request, zero additional image-load events, and zero pixels of anchor displacement. The liked state and requested playback Pause control survived. This is a rendering test, not a completed playback or current ownership claim.

Results are in `data/collection-render-verification.json`; all four `captures/collection-render-*` theme/viewport screenshots were visually reviewed. The broader collector discovery fixture suite also passed after the update, including pagination retry and filter focus. Seventeen focused collection/identity/image-fallback tests passed.

No gateway substitution, artwork transformation, new cache service, or full-catalog preload was introduced. The change removes redundant DOM work; it does not make slow remote storage universally fast.
