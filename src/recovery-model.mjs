export const chainNames = {
  solana: "Solana",
  1: "Ethereum",
  10: "Optimism",
  8453: "Base",
  137: "Polygon",
  7777777: "Zora",
};
export const explorers = {
  1: "https://etherscan.io",
  10: "https://optimistic.etherscan.io",
  8453: "https://basescan.org",
  137: "https://polygonscan.com",
  7777777: "https://explorer.zora.energy",
};
export function recoverySummary(records, snapshot) {
  return {
    catalogued: records.length,
    indexed: records.filter((r) => snapshot[r.id]?.status === "indexed").length,
    readable: records.filter((r) => snapshot[r.id]?.status === "live").length,
    unavailable: records.filter((r) => snapshot[r.id]?.status === "unavailable")
      .length,
    notAttempted: records.filter((r) => !snapshot[r.id]).length,
    sound: records.filter(
      (r) => r.platform === "Sound" || r.originalRelease?.includes("sound.xyz"),
    ).length,
    chains: [...new Set(records.map((r) => r.chainId))].map(
      (id) => chainNames[id] || String(id),
    ),
  };
}
export function sourceKind(uri) {
  return uri?.startsWith("data:")
    ? "Onchain JSON"
    : uri?.startsWith("ar:") || uri?.includes("arweave.net")
      ? "Arweave"
      : uri?.startsWith("ipfs:") || uri?.includes("/ipfs/")
        ? "IPFS"
        : "External storage";
}
export function normalizePlaylist(data, supplemental = []) {
  const p = data.props.pageProps,
    s = p.shelf,
    edges = p.shelfData.releases.edges;
  const byTrack = new Map(edges.map((e) => [e.node.release.track.id, e.node]));
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    curator: s.user.username,
    capturedAt: "2023-01-20T20:08:48Z",
    source:
      "https://web.archive.org/web/20230120200848/https://www.sound.xyz/playlist/" +
      s.id,
    declaredCount: s.releaseCount,
    tracks: s.trackIds.map((id, index) => {
      const n = byTrack.get(id);
      return n
        ? {
            id,
            index,
            title: n.release.title,
            artist: n.release.artist.name,
            artistHandle: n.release.artist.soundHandle,
            titleSlug: n.release.titleSlug,
            addedAt: n.addedAt,
            audioURL: n.release.track.revealedAudio?.url,
            coverURL: n.release.coverImage?.url,
          }
        : supplemental.some((t) => t.id === id)
          ? { ...supplemental.find((t) => t.id === id), id, index }
          : { id, index, missing: true };
    }),
  };
}
