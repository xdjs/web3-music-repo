// Only known collection/token pairs can reach this read-only adapter.
const RPCS = {
  1: "https://ethereum-rpc.publicnode.com",
  10: "https://optimism-rpc.publicnode.com",
  8453: "https://base-rpc.publicnode.com",
  7777777: "https://rpc.zora.energy",
};
export function storageURL(uri) {
  if (typeof uri !== "string" || uri.length > 2048)
    throw Error("Unsupported media address");
  if (uri.startsWith("ipfs://")) {
    const path = uri.slice(7).replace(/^ipfs\//, "");
    if (!/^[A-Za-z0-9]+(?:[/?][^\s]*)?$/.test(path) || path.includes(".."))
      throw Error("Invalid IPFS address");
    return "https://ipfs.filebase.io/ipfs/" + path;
  }
  if (uri.startsWith("ar://"))
    return storageURL("https://arweave.net/" + uri.slice(5));
  const url = new URL(uri);
  if (url.protocol === "https:" && url.pathname.startsWith("/ipfs/"))
    return storageURL("ipfs://" + url.pathname.slice(6) + url.search);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    (![
      "arweave.net",
      "ipfs.filebase.io",
      "arpeggi-prod-public.s3.us-west-2.amazonaws.com",
    ].includes(url.hostname) &&
      !/^[a-z0-9-]+\.arweave\.net$/.test(url.hostname) &&
      !(
        /^[a-z2-7]{52}-data\.legacy\.datasprite-cdn\.com$/.test(url.hostname) &&
        /^\/[A-Za-z0-9_-]{43}$/.test(url.pathname)
      ) &&
      !(
        url.hostname === "gateway.irys.xyz" &&
        /^\/(mutable\/)?[A-Za-z0-9_-]{43}$/.test(url.pathname)
      ) &&
      !(
        url.hostname === "www.arpeggi.io" &&
        /^\/api\/v2\/kits-metadata\/0x[0-9a-f]{40}\/\d+$/i.test(url.pathname)
      ))
  )
    throw Error("Unsupported storage host");
  return url.href;
}
export function decodeString(value) {
  if (!/^0x[0-9a-f]+$/i.test(value || "") || value.length > 524288)
    throw Error("Invalid contract result");
  const hex = value.slice(2),
    offset = parseInt(hex.slice(0, 64), 16) * 2;
  const length = parseInt(hex.slice(offset, offset + 64), 16);
  if (
    !Number.isSafeInteger(length) ||
    length < 1 ||
    length > 131072 ||
    offset + 64 + length * 2 > hex.length
  )
    throw Error("Invalid metadata length");
  return Buffer.from(
    hex.slice(offset + 64, offset + 64 + length * 2),
    "hex",
  ).toString("utf8");
}
async function jsonResponse(res) {
  if (!res.ok) throw Error("Upstream unavailable");
  let bytes = 0;
  const chunks = [];
  for await (const chunk of res.body) {
    bytes += chunk.length;
    if (bytes > 1048576) throw Error("Metadata too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
async function storageJSON(url, fetcher) {
  for (let i = 0; i < 4; i++) {
    const res = await fetcher(storageURL(url), {
      signal: AbortSignal.timeout(12000),
      redirect: "manual",
    });
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      url = storageURL(new URL(res.headers.get("location"), url).href);
      continue;
    }
    return jsonResponse(res);
  }
  throw Error("Too many storage redirects");
}
export async function readNFT(record, fetcher = fetch) {
  const rpc = async (method, params) => {
    const d = await jsonResponse(
      await fetcher(RPCS[record.chainId], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(8000),
      }),
    );
    if (d.error || !d.result) throw Error("Contract read unavailable");
    return d.result;
  };
  try {
    if (
      !RPCS[record.chainId] ||
      !/^0x[0-9a-f]{40}$/i.test(record.contract) ||
      !/^\d+$/.test(record.tokenId)
    )
      throw Error("Invalid reference");
    const block = await rpc("eth_blockNumber", []);
    const uri = decodeString(
      await rpc("eth_call", [
        {
          to: record.contract,
          data:
            (record.standard === "ERC1155" ? "0x0e89341c" : "0xc87b56dd") +
            BigInt(record.tokenId).toString(16).padStart(64, "0"),
        },
        block,
      ]),
    );
    const legacyCatalog =
      record.contract.toLowerCase() ===
      "0xabefbc9fd2f806065b4f3c237d4b59d9a97bcac7";
    const metadataURI = legacyCatalog
      ? decodeString(
          await rpc("eth_call", [
            {
              to: record.contract,
              data:
                "0x157c3df9" +
                BigInt(record.tokenId).toString(16).padStart(64, "0"),
            },
            block,
          ]),
        )
      : uri;
    let metadata,
      metadataURL = null;
    if (metadataURI.startsWith("data:application/json;base64,"))
      metadata = JSON.parse(
        Buffer.from(metadataURI.split(",")[1], "base64").toString("utf8"),
      );
    else {
      metadataURL = storageURL(metadataURI);
      metadata = await storageJSON(metadataURL, fetcher);
    }
    const mediaURI = legacyCatalog
      ? uri
      : metadata.animation_url ||
        metadata.animation ||
        metadata.audio ||
        metadata.losslessAudio;
    const mediaURL = storageURL(mediaURI);
    let imageURL = null;
    try {
      imageURL = storageURL(
        legacyCatalog ? metadata.body?.artwork?.info?.uri : metadata.image,
      );
    } catch {}
    return {
      status: "live",
      chainId: record.chainId,
      contract: record.contract,
      tokenId: record.tokenId,
      blockNumber: parseInt(block, 16),
      checkedAt: new Date().toISOString(),
      title: String(
        (legacyCatalog ? metadata.body?.title : metadata.name) || record.title,
      ).slice(0, 200),
      artist: String(
        (legacyCatalog
          ? metadata.body?.artist
          : metadata.artist_name || metadata.artist) || "",
      ).slice(0, 200),
      imageURI: legacyCatalog
        ? metadata.body?.artwork?.info?.uri || null
        : typeof metadata.image === "string"
          ? metadata.image
          : null,
      mediaURI,
      mediaURL,
      imageURL,
      metadataURL,
      metadataURI,
      metadataLocation: metadataURL
        ? "Token URI → storage metadata"
        : "Metadata returned directly by the contract",
      kind: record.kind,
    };
  } catch {
    return {
      status: "unavailable",
      message:
        "The original token or media metadata could not be reached. Try again or inspect the collection.",
    };
  }
}
