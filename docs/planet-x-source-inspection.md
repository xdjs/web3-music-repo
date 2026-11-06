# Planet X: direct-source audio excerpt

The original IPFS MP4 contains one H.264 video stream and one stereo AAC audio stream, lasting 240.083 seconds. The presence of only one audio stream does **not** rule out overlapping sounds already mixed into that stream.

An independent excerpt around **1:48–2:10** is available outside the application:

- `work/planet-x-108-130-original.m4a`: 22.006 seconds, original AAC packets copied without re-encoding, normalization, remixing or effects. The slight duration difference follows AAC packet boundaries.
- `work/planet-x-108-130-original.wav`: a 22-second stereo, 48 kHz PCM decoding of the same source interval, without processing effects.

These ignored local files can be auditioned directly to compare the original recording with the app at the same timestamp. No perceptual conclusion about the reported overlap has been made from container metadata alone.

## Bounded recovery and evidence

Source: `https://magic.decentralized-content.com/ipfs/bafybeidiwm2sgde6t4pbccgcraah6g5qt6m2jo73o6rhdwszhy7szxoxne?id=1`.

The existing first 1 MiB contained the MP4 metadata/index. A sparse local file retained the original declared size of 310,039,114 bytes, while only audio-interleaved source bytes **137,959,295–171,392,595** were additionally fetched. The server returned the exact expected HTTP 206 Content-Range and CID ETag. Actual downloaded data, including the pre-existing header, totals **34,481,877 bytes**, below the 64 MiB bound. The sparse file is an extraction aid, not a complete playable copy of the source.

Every inspected audio packet for the requested excerpt falls within the downloaded range; audio packet timestamps increase monotonically. `ffmpeg` extracted the AAC clip with `-ss 108 -t 22 -map 0:a:0 -vn -c:a copy`. No application code or original media was changed.

`data/playback-source-inspection.json` contains stream metadata, range receipt, exact artifact paths and SHA-256 hashes. The source's internal mixing and the application's playback behavior remain separate questions; this excerpt supports a direct A/B comparison.
