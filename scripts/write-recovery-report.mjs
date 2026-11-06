import { readFileSync, writeFileSync } from "node:fs";
import { createCatalogLoader } from "../src/catalog-bundle.mjs";
import {
  expansionCoverage,
  catalogCoverage,
} from "../src/recovery-coverage.mjs";
const read = (f) => JSON.parse(readFileSync(f));
const bundle = createCatalogLoader()(),
  manifest = read("data/census/manifest.json"),
  modern = read("data/sound-expanded.json"),
  legacy = read("data/legacy-expanded.json"),
  fallback = read("data/sound-fallback.json"),
  profiles = read("data/historical-profiles.json"),
  comments = read("evidence/sound-wayback/recovered-comments.json"),
  audit = read("data/playback-audit.json"),
  extra = read("data/expanded-playback-audit.json"),
  exp = expansionCoverage(modern, fallback);
const counts = {
  generatedAt: new Date().toISOString(),
  catalog: bundle.records.length,
  artists: new Set(bundle.records.map((r) => r.artistId || r.artist)).size,
  artworkOnly: bundle.records.filter((r) => r.kind === "artwork").length,
  factoryContracts: manifest.factories.reduce((n, f) => n + f.contracts, 0),
  modern: exp,
  catalogPlayback: read("data/catalog/playback-audit.json"),
  catalogWorks: catalogCoverage(
    read("data/catalog/token-inventory.json"),
    read("data/catalog/archived-media.json"),
    read("data/catalog/live-verification.json"),
  ),
  soundMetadataGaps: Object.values(
    read("data/sound-metadata-gaps.json").results,
  ).reduce((counts, r) => {
    counts[r.status] = (counts[r.status] || 0) + 1;
    return counts;
  }, {}),
  legacyRecords: legacy.records.length,
  profiles: profiles.length,
  preservedAvatars: profiles.filter((p) => p.localAvatar).length,
  comments: comments.length,
  commentedReleases: new Set(comments.map((c) => c.releaseId)).size,
  playback: {
    startingChecked: Object.keys(audit.results).length,
    startingPlayed: Object.values(audit.results).filter(
      (r) => r.status === "played",
    ).length,
    expandedChecked: Object.keys(extra.results).length,
    expandedPlayed: Object.values(extra.results).filter(
      (r) => r.status === "played",
    ).length,
  },
};
writeFileSync("data/recovery-report.json", JSON.stringify(counts, null, 2));
writeFileSync(
  "docs/recovery-report.md",
  `# Recovery report\n\nGenerated ${counts.generatedAt}. Open http://127.0.0.1:4190.\n\n## Recovered and integrated\n\n- ${counts.catalog} catalog records, including ${counts.artworkOnly} artwork-only collectibles labeled without play controls.\n- ${counts.factoryContracts} factory-created contracts across Ethereum and Optimism: 172 legacy artist contracts and 9,316 modern release contracts. All index pages were read through the blocks recorded in the census manifest.\n- ${exp.recovered} modern contracts with recovered representative metadata; ${legacy.records.length} legacy artist editions recovered. Representative tokens are not a complete enumeration of all token variants.\n- ${exp.unminted} contracts verified with zero minted tokens; ${exp.unresolved} attempted contracts remain unresolved. Factory deployments are permissionless and do not by themselves prove a Sound website listing.\n- ${counts.profiles} archived wallet-linked profiles; ${counts.preservedAvatars} avatars preserved locally. Historical images and current forward-verified ENS identities are separately attributed.\n- ${counts.comments} archived comments across ${counts.commentedReleases} releases. These are web-archive evidence, not onchain recovery.\n- Pete Rango's Breakdown recovered and playback-tested, alongside the original documented production credits.\n\n## Catalog Works\n\nOfficial March 9, 2026 export: ${counts.catalogWorks.tokenEntries} token entries (${counts.catalogWorks.ethereum} Ethereum and ${counts.catalogWorks.base} Base), excluding testnets. ${counts.catalogWorks.indexedMedia} entries preserve supported media references; ${counts.catalogWorks.currentMetadata} have successful current contract metadata reads as of this report. Token entries are not unique-song totals, and media references are not playback proof. Browser playback samples: ${counts.catalogPlayback.results.filter((r) => r.status === "played").length}/${counts.catalogPlayback.results.length} passed. These are start checks, not full-track auditions. This snapshot does not establish all releases through today. Source: https://github.com/catalogworks/catalog-squidward-data .\n\n## Sound metadata diagnosis\n\nOf the previously unresolved representative reads, ${counts.soundMetadataGaps["metadata-without-audio"] || 0} returned metadata with empty audio fields, ${counts.soundMetadataGaps["media-present-retry"] || 0} returned a media reference needing integration/retry, and ${counts.soundMetadataGaps.unavailable || 0} remained unavailable. These are representative-token observations, not proof that no other token tier has audio.\n\n## Working product\n\nArtist/title/collaborator search, persistent audio/video playback, player queue, likes, editable local playlists with export, artist pages and sourced links, song-level collectors, collector profiles, matched song comments, archived playlist, evidence export, light/dark themes and mobile layouts.\n\nModern collectors are scoped to verified release factories. Legacy collectors filter NFT instances through the contract's edition-ID encoding or tokenToEdition reads; uint256 IDs and pagination cursors retain their full precision. These are current indexed holders, not original minters.\n\n## Verification\n\n${counts.playback.startingPlayed}/${counts.playback.startingChecked} starting-catalog records advanced playback in Chromium; ${counts.playback.expandedPlayed}/${counts.playback.expandedChecked} additional modern/legacy samples passed. Checks start the real original media; they are not full-track auditions. Failures remain in the audit files. Two starting-catalog entries identify artwork-only metadata.\n\nBrowser flows verified search, playback, playlist persistence/reordering/next, collector pagination and profiles, live contract reread, matched song comments, desktop/mobile and light/dark layouts. A legacy release check recovered 24 wallets holding its 25 edition tokens.\n\n## Explicit gaps\n\n- Base and Polygon canonical V2 factory runtime matches the verified source after normalizing only declared immutable slots. Historical event scans are incomplete because public RPC/indexer access was limited. No zero-collection conclusion is drawn.\n- Unknown factories, out-of-factory clones, all mint/transfer history, all token variants, every missing media file, and a complete Sound social graph are not established.\n- The archived Chill n Work playlist retains 23 ordered IDs but 16 detailed entries (15 from the playlist page and one recovered by exact track ID from a July 2022 capture). Seven track IDs remain unresolved; missing pages were not invented.\n- Browser-local playlists work. Music Nerd production Privy email sign-in is configured and its login UI verified. The server validates signed tokens and resolves the canonical Music Nerd user through a read-only database connection. Explicit account playlist save/load uses private storage on this archive server with revision conflict checks. A real login attempt failed with Privy 403 invalid_origin: http://127.0.0.1:4190 is not allowed by the production app. Real signed-in save/load remains unverified until that origin is configured and the user completes email authentication. This is not durable serverless cloud storage. Full wallet-library listening remains unfinished.\n- Local preview only; no production deployment or outbound publication was performed.\n\n## Reproduce and resume\n\n\`node scripts/census-sound.mjs\` regenerates known Ethereum/Optimism factory inventories. \`node scripts/expand-sound.mjs\` resumes representative metadata recovery. \`node scripts/recover-legacy-editions.mjs\` enumerates legacy editions. \`node scripts/recover-representatives.mjs\` checks mint state and alternative representative tokens. \`node scripts/write-recovery-report.mjs\` refreshes this report. Network access is required. Run only one writer per output file.\n\nThe original dirty documentary checkout is preserved. Evidence and local implementation are under the isolated music-nft-recovery workspace.\n`,
);
console.log(counts);
