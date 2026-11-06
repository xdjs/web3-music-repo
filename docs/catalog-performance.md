# Catalog loading measurements

The probe runs fresh headless Chromium contexts at 1440×1000 and 390×844 on the same host. The smaller viewport enables touch/mobile layout but does not simulate a phone CPU, network, battery or browser. Local port 4191 serves the real compressed catalog endpoint. Results are diagnostic snapshots, not field performance percentiles.

`verify-catalog-performance.mjs` instruments only the index response: `response.text()` measures remaining body reading and text decoding; a timed `JSON.parse` measures parsing separately. It records Resource Timing transfer sizes, observed readiness after the first 40 cards and search exist, a search input dispatch followed by two animation frames, long tasks, and Chromium cumulative CPU/heap counters. The latter include unrelated page work; heap is not forced-GC retained memory. The JSON parser wrapper can change allocation timing slightly.

## 31,220-record baseline

Two sequential sample sets, before Nina data integration, are preserved in `data/catalog-performance-baseline.json` and `data/catalog-performance-baseline-dom.json`.

- Index: 4,123,956 compressed bytes; 27,943,016 decoded bytes; 4,458 people.
- JSON parsing: approximately 32.5–37.1ms on this host.
- Observed initial Explore readiness: 213–275ms from navigation, using local serving.
- Search dispatch through two animation frames: 49–64ms; 29 Pete Rango results.
- Post-search JavaScript heap snapshots:43–58MB. These vary with garbage collection.
- Explore renders 40 recording cards, but also 4,717 collection options: 5,525 live DOM elements before search and 5,383 after filtering. The collection list is rebuilt from the whole catalog on each search render.

The collection selector is a concrete optimization candidate: cache stable choices and avoid reconstructing its thousands of option elements on every keystroke, or use an accessible searchable selector. This observation does not establish poor field performance on every device. Chunked/server-side catalog loading remains relevant as the index grows; a small local parsing time does not make a 4MB download inexpensive over mobile networks.

## 37,274-record Nina candidate

`data/catalog-performance-nina-candidate.json` is a separate quiet pass after UI verification, using the same local endpoint and instrumentation. The candidate adds 6,054 Nina recordings and has 6,169 people.

| Measurement | Baseline | Nina candidate |
| --- | --- | --- |
| Compressed index bytes | 4,123,956 | 5,605,396 |
| Decoded index bytes | 27,943,016 | 33,448,877 |
| JSON parse on this host | 32.5–37.1ms | 40.1ms |
| Observed local Explore readiness | 213–275ms | 233–234ms |
| Search dispatch through two frames | 49–64ms | 52–62ms |
| Post-search JS heap snapshots | 43–58MB | 45–58MB |
| Collection options | 4,717 | 4,717 |

The compressed download increased approximately 36%; decoded content increased approximately 20%. Tiny sample counts, runtime variation and garbage collection mean these timings cannot establish a statistically meaningful regression or phone performance. Both viewport checks rendered the first 40 cards and searched successfully without JavaScript errors. The candidate produced an 80–81ms long task during initial index parsing/application setup; baseline samples included 70–76ms tasks. Network payload remains the clearest growth cost.

## Nina UI checks

`data/nina-ui-verification.json` and `captures/nina-proof-{1440,390}-{light,dark}.png` verify the 6,054-record Nina filter, Solana network selection, exclusion from Other platforms, correct case-sensitive mint/explorer link, separate Nina release address, preserved indexed provenance, and artist navigation/search. No EVM owner/holder controls or collector API requests appear. The honest unavailable-collector message remains visible. A preserved-audio fallback keeps its original reference and describes the bounded startup failure and possible transcode. All four rendered proof layouts were inspected without horizontal overflow. The first immediate screenshots showed a loading placeholder. A separate bounded read confirmed the original Error Handling Arweave cover at 1500×1500 (`data/nina-cover-verification.json`); the UI script now waits up to 12 seconds for that image and records its actual loaded state. This is one cover check, not catalog-wide image verification.


The final UI capture pass loaded the original cover on mobile but hit its 12-second deadline on desktop, where the existing fallback appeared. The independent 1500×1500 success shows the reference can resolve; repeated success is not guaranteed by this receipt.
