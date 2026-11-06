import test from "node:test";
import assert from "node:assert/strict";
import { readNFT } from "../src/nft-reader.mjs";
import { readOwner } from "../src/recovery-owner.mjs";
import {
  readHolders,
  readTokenHolders,
  readMediaHolders,
} from "../src/recovery-holders.mjs";
import { readCollectors } from "../src/recovery-collectors.mjs";
import { readWalletPage } from "../src/wallet-library.mjs";
import { indexRecord } from "../src/catalog-presentation.mjs";
import { renderSolanaProvenance } from "../src/solana-provenance.mjs";
import { mountCollectors } from "../src/collectors-ui.mjs";
import { chainNames } from "../src/recovery-model.mjs";
const mint = "122gW5E6uqWKEsb1KdCjVhWtarbCTdN7hR1bjt9dgdaw";
const record = {
  id: "nina-test",
  chainId: "solana",
  mint,
  standard: "METAPLEX",
  platform: "Nina",
  title: "Error Handling",
  artist: "Igor Dyachenko",
  kind: "audio",
  originalRelease:
    "https://nina.market/CZ2wpojt6YHhPPaGJNUuyXPAFDwGjEK1tbJHipcMT1Wn",
};
const evidence = {
  status: "indexed",
  source: "https://api.spinamp.xyz/v3/graphql",
  mediaSourceType: "indexed-nft-media",
  metadataURI: "ar://metadata",
  metadataURL: "https://arweave.net/metadata",
  mediaURI: "ar://media",
  mediaURL: "https://arweave.net/media",
};
const esc = (v) =>
  String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
test("Solana mint reads never enter EVM metadata, owner or holder adapters", async () => {
  let calls = 0;
  const forbidden = () => {
    calls++;
    throw Error("EVM adapter called");
  };
  for (const fn of [
    () => readNFT(record, forbidden),
    () => readOwner(record, forbidden),
    () => readHolders(record, null, forbidden),
    () => readTokenHolders(record, null, forbidden),
    () => readMediaHolders(record, null, forbidden),
    () =>
      readCollectors(
        {
          ...record,
          factoryVersion: 0,
          legacyEditionId: "1",
          collectorMediaURI: "ipfs://example",
        },
        null,
        new Map(),
        {
          readOwner: forbidden,
          readHolders: forbidden,
          readLegacyCollectors: forbidden,
          readTokenHolders: forbidden,
          readMediaHolders: forbidden,
        },
      ),
  ]) {
    const result = await fn();
    assert.equal(result.status, "unsupported");
    assert.equal(result.scope, "solana-mint");
    assert.match(result.message, /not implemented/);
  }
  assert.equal(calls, 0);
});
test("Solana wallet request cannot scan EVM networks or report an empty successful wallet", async () => {
  let calls = 0;
  const result = await readWalletPage(
    mint,
    "solana",
    null,
    [record],
    new Map(),
    () => {
      calls++;
    },
  );
  assert.equal(result.status, "unsupported");
  assert.match(result.message, /wallet-owned Nina/);
  assert.equal(calls, 0);
});
test("compact catalog preserves case-sensitive mint without inventing contract or token ID", () => {
  const row = indexRecord(record, evidence);
  assert.equal(row.mint, mint);
  assert.equal(row.chainId, "solana");
  assert.equal(chainNames[row.chainId], "Solana");
  assert.equal(row.recovery.mediaURL, evidence.mediaURL);
  assert.ok(!("contract" in row));
  assert.ok(!("tokenId" in row));
});
test("Solana provenance links mint and release separately, escapes metadata and omits EVM controls", () => {
  const html = renderSolanaProvenance(
    {
      ...record,
      recovery: { ...evidence, metadataURI: "<script>bad</script>" },
    },
    esc,
  );
  assert.ok(html.includes("https://explorer.solana.com/address/" + mint));
  assert.ok(html.includes(record.originalRelease));
  assert.ok(html.includes("&lt;script&gt;bad&lt;/script&gt;"));
  assert.match(html, /not been independently verified/);
  assert.doesNotMatch(
    html,
    /data-recover|data-owner|data-holders|token\/undefined|Token ID undefined|contractURI/,
  );
  const invalid = renderSolanaProvenance(
    {
      ...record,
      mint: "bad",
      originalRelease: "javascript:alert(1)",
      recovery: evidence,
    },
    esc,
  );
  assert.doesNotMatch(invalid, /javascript:|explorer.solana.com\/address\/bad/);
});
test("Solana collectors render unavailable capability and make no automatic network requests", async () => {
  const oldDocument = globalThis.document,
    oldFetch = globalThis.fetch;
  let calls = 0;
  globalThis.document = { addEventListener() {} };
  globalThis.fetch = () => {
    calls++;
    throw Error("Unexpected request");
  };
  try {
    const ui = mountCollectors({
      esc,
      short: (x) => x,
      date: (x) => x,
      explorers: {},
      chainNames,
      catalog: () => [record],
      recordLink: (r) => "#record/" + r.id,
      rerender() {},
    });
    const html = ui.panel(record, true);
    assert.match(html, /Solana collectors/);
    assert.match(html, /does not mean the mint has no collectors/);
    assert.doesNotMatch(html, /Recovering|No holders returned/);
    await ui.load(record.id);
    assert.equal(calls, 0);
  } finally {
    globalThis.document = oldDocument;
    globalThis.fetch = oldFetch;
  }
});

test("Nina timeout fallback preserves the original source and names its actual reason", () => {
  const original = "https://www.arweave.net/original";
  const html = renderSolanaProvenance(
    {
      ...record,
      recovery: {
        ...evidence,
        mediaSourceType: "spinamp-preserved-audio",
        originalMediaUnavailableReason: "original-startup-timeout",
        originalMediaURI: original,
      },
    },
    esc,
  );
  assert.match(html, /did not start during a bounded playback check/);
  assert.match(html, /may be transcoded/);
  assert.ok(html.includes(original));
  assert.doesNotMatch(html, /unsupported host|no original media/);
});
