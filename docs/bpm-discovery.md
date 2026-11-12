# Find music by tempo

Open Explore and use **Min BPM** and **Max BPM** in the existing filter bar. Either end can be left blank. The range is inclusive and accepts decimal tempos from 20 to 400 BPM; reversed bounds are reordered with a notice. Set both bounds to the same value for an exact match.

Choose **BPM: low to high** or **BPM: high to low** from Sort. Unknown tempos appear last when sorting and are excluded when a range is active. Range and sort combine with artist/title search, platform, network, media, collection and the existing My collection scope. They also apply to Liked sounds through the same Explore renderer.

BPM tags appear on shared song cards wherever a tempo is available, including unfiltered Explore, Home, artist and collection grids. Filters are not required to see tempo. A tilde marks an Open BPM estimate; source-supplied tempo retains precedence. Estimates can be half/double tempo and are not automatically converted to fit a requested range. Some records have no tempo yet.

Explore remembers its validated tempo settings in the browser. Reset filters clears them. Public wallet/collector filter preferences are unchanged. Original audio is not modified or transcoded for analysis.

## Verification

Range boundaries, source/estimate labels, unknown handling, deterministic sorting, invalid values and preference isolation have focused regression tests. `scripts/verify-bpm-filter-ui.mjs` exercises the actual controls and responsive design. See the release receipt for staged and production checks; source unit tests alone do not establish browser behavior.
