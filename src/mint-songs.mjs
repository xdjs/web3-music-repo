import { decodeAbiParameters } from "viem";
import { extractMusicMetadata } from "./extract-music-metadata.mjs";

export const MINT_SONGS_V2 = "0x2b5426a5b98a3e366230eba9f95a24f09ae4a584";
export const MINT_SONGS_SNAPSHOT = "6251e3611e3c64277ed7cb4076a242130ea729de";
export const MINT_SONGS_SOURCE = `https://github.com/neume-network/data/blob/${MINT_SONGS_SNAPSHOT}/results/mintsongs-get-tokenuri-extraction`;

// Normalize only public IPFS references. A publisher's old gateway is not the CID.
export function mintSongsIPFS(value) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  const path = text.startsWith("ipfs://")
    ? text.slice(7).replace(/^ipfs\//, "")
    : /^https:\/\/[^/]+\/ipfs\/(.+)$/.exec(text)?.[1];
  if (
    !path ||
    !/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{20,})(?:\/[^?#\s]*)?$/.test(path)
  )
    return null;
  return `ipfs://${path}`;
}

export function mintSongsTokenURI(result) {
  return decodeAbiParameters([{ type: "string" }], result)[0];
}
const gateway = (uri) =>
  uri ? `https://gateway.pinata.cloud/ipfs/${uri.slice(7)}` : null;

export function mintSongsBundle(rows, calls, recoveredAt) {
  const records = [],
    evidence = {},
    originals = {},
    seen = new Map();
  const callMap = new Map(
    calls.map((row) => [
      `${row.metadata?.contract?.address?.toLowerCase()}:${row.metadata?.tokenId}`,
      row,
    ]),
  );
  let duplicates = 0;
  for (const row of rows) {
    const { metadata: ref, results: metadata } = row;
    if (
      ref?.contract?.address?.toLowerCase() !== MINT_SONGS_V2 ||
      !/^\d+$/.test(ref.tokenId)
    )
      throw Error("Unexpected Mint Songs token identity");
    const call = callMap.get(`${MINT_SONGS_V2}:${ref.tokenId}`);
    const source = mintSongsIPFS(ref.tokenURI);
    if (
      !source ||
      !call ||
      mintSongsIPFS(mintSongsTokenURI(call.results)) !== source
    )
      throw Error(`Token URI evidence mismatch: ${ref.tokenId}`);
    const id = `mint-songs-1-${MINT_SONGS_V2.slice(2)}-${ref.tokenId}`;
    const fingerprint = JSON.stringify(metadata);
    if (seen.has(id)) {
      if (seen.get(id) !== fingerprint)
        throw Error(`Conflicting snapshot: ${id}`);
      duplicates++;
      continue;
    }
    seen.set(id, fingerprint);
    const mediaURI = mintSongsIPFS(
      metadata.losslessAudio || metadata.animation_url,
    );
    if (
      !mediaURI ||
      !/^audio\//.test(metadata.mimeType || "") ||
      !metadata.artist?.trim() ||
      !metadata.title?.trim()
    )
      throw Error(`Missing audio identity: ${id}`);
    const normalized = {
      ...metadata,
      credits: (metadata.credits || []).map((c) => ({
        ...c,
        role: c.role || c.collaboratorType,
      })),
    };
    const musicMetadata = {
      status: "read",
      schemaVersion: 3,
      source,
      sourceType: "preserved-ipfs-metadata",
      recoveredAt,
      snapshotSource: MINT_SONGS_SOURCE,
      metadataURL: gateway(source),
      ...extractMusicMetadata(normalized),
    };
    records.push({
      id,
      chainId: 1,
      standard: "ERC721",
      contract: MINT_SONGS_V2,
      tokenId: ref.tokenId,
      platform: "Mint Songs",
      kind: "audio",
      title: metadata.title,
      artist: metadata.artist,
      note: metadata.description || "",
      imageURI: mintSongsIPFS(metadata.image || metadata.artwork?.uri),
      originalRelease: `https://www.mintsongs.com/tokens/${MINT_SONGS_V2}/${ref.tokenId}`,
      musicMetadata,
    });
    evidence[id] = {
      status: "indexed",
      checkedAt: recoveredAt,
      metadataURI: source,
      mediaURI,
      metadataURL: gateway(source),
      mediaURL: gateway(mediaURI),
      imageURI: mintSongsIPFS(metadata.image || metadata.artwork?.uri),
      imageURL: gateway(mintSongsIPFS(metadata.image || metadata.artwork?.uri)),
      contentType: metadata.mimeType,
      source: MINT_SONGS_SOURCE,
      sourceName: "Neume's preserved Mint Songs metadata",
      sourceURL: MINT_SONGS_SOURCE,
      referenceBlock: Number(ref.block.number),
      note: "Preserved Neume metadata matched to its historical tokenURI result. Live playback and current ownership are not established by this snapshot.",
    };
    originals[id] = { ...row, chainId: 1, tokenURICall: call.results };
  }
  records.sort((a, b) => Number(a.tokenId) - Number(b.tokenId));
  return {
    bundle: {
      recoveredAt,
      source: MINT_SONGS_SOURCE,
      scope:
        "Partial Ethereum V2 snapshot; excludes Polygon Factory and Editions",
      records,
      evidence,
    },
    originals,
    report: {
      recoveredAt,
      sourceRows: rows.length,
      duplicateRows: duplicates,
      uniqueTokens: records.length,
      artists: new Set(records.map((r) => r.artist)).size,
      originalBPM: records.filter((r) => r.musicMetadata.bpms.length).length,
      originalKeys: records.filter((r) => r.musicMetadata.keys.length).length,
      explicitCredits: records.filter((r) => r.musicMetadata.credits.length)
        .length,
      duration: records.filter((r) => r.musicMetadata.details.Duration).length,
      complete: false,
    },
  };
}
