# Bounded Arweave playback recovery

The player can retry an Arweave media request through a second fixed gateway while preserving its transaction ID, path and query. The recognized input hosts are `arweave.net`, its `www`/content-sandbox subdomains, and `turbo-gateway.com` with its content-sandbox subdomains. Only paths beginning with a 43-character transaction ID qualify. Credentials, ports, arbitrary hosts, ArNS names, API endpoints, traversal and encoded separators are rejected. Existing IPFS fallback behavior remains bounded and unchanged.

The alternate is documented by the gateway operator in the [ar.io data access guide](https://docs.ar.io/build/access/fetch-data/), which describes transaction-addressed requests and sandbox redirects. This changes the access gateway, not the catalog’s original content reference. It is not a new chain verification or whole-file hash comparison. Once finite alternates are exhausted, a merely slow request stays pending instead of being called an unavailable file without a media error. Pausing or disposing recovery still prevents autoplay retries.

## User-reported recordings

`data/arweave-playback-verification.json` contains actual player checks for the exact “Endless,” “Army of Love” and “Por Tu Barrio” records. Army of Love and Por Tu Barrio decoded and advanced through the same-transaction Turbo fallback. Endless initially started but buffered during the short advancement assertion; that result remains recorded. A separate isolated recheck with a longer bounded advancement window passed: `data/arweave-endless-recheck.json`. These establish sampled startup and advancement, not uninterrupted complete-song playback or permanent gateway availability.

`data/spinamp/two-processed-copy-verification.json` independently checks the exact indexed copies of Endless and Army of Love. Chain, contract, token ID, original media and metadata references all match. Both copies decoded and advanced. Army of Love’s copy is MP3 (about 7.8 MB); Endless’s is WAV (about 77.7 MB), so it must not be described as a confirmed compressed or transcoded version. Any preferred-copy integration is separately bound to these exact identities, keeps original evidence available and labels the Spinamp playback source. It is distinct from an artist-supplied correction.

Thirteen focused media/image recovery tests passed after this change. The full unit suite subsequently passed 262 tests, including the local video HTTP range test; later additions should rerun the suite before release. No paid service or full media scan was used.
