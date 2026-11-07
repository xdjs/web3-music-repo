# Sound census and current catalog reconciliation

The November 6 factory scan and the current listening catalog answer different questions. A failed original contract/metadata read can coexist with a subsequently recovered, explicitly indexed recording.

`scripts/reconcile-sound-coverage.mjs` joins the five preserved Ethereum/Optimism factory censuses to the current catalog and its media evidence using exact chain and contract, with matching token identity required between each recording and its evidence. Artist/title similarity does not count. Legacy artist contracts remain separate from modern release contracts. Raw historical attempts are not rewritten.

At the initial reconciliation, the preserved census contains 9,488 contracts: 172 legacy artist contracts and 9,316 modern release contracts. Of the 1,256 modern contracts unresolved by the original read pass, 1,194 now have exact matching indexed-media evidence and 62 do not. This explains why the old unresolved number overstated the remaining catalog gap. These are contracts, not distinct songs, editions, collectors or verified playback sessions.

The evidence is `data/sound-resolution/catalog-reconciliation.json`, also served by `/api/coverage/sound-reconciliation`. The recovery ledger preserves historical read outcomes and adds a separately labeled reconciliation. Rerun the script whenever imported source data changes; the receipt timestamp and catalog size identify its scope.

This does not complete the factory census, establish official Sound listing on every compatible chain, refresh ownership, or prove the referenced audio can currently play. A matching index entry never changes a historical RPC failure into an onchain verification. Base/Polygon factory discovery and unenumerated deployments remain separate work. The 44 unresolved Spinamp references are another cohort and must not be added to these 62 as though they were disjoint.
