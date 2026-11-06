const ETH = "0x0000000000000000000000000000000000000000";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const EMITTER = "0x6170b3c3a54c3d8c854934cbc314ed479b2b29a3";
const address = /^0x[0-9a-f]{40}$/i;
const hash = /^0x[0-9a-f]{64}$/i;
const integer = /^(0|[1-9][0-9]*)$/;
const lower = (value) => (typeof value === "string" ? value.toLowerCase() : "");

export function formatRoyaltyAmount(raw) {
  if (typeof raw !== "string" || raw.length > 78 || !integer.test(raw))
    throw Error("Invalid royalty amount");
  const value = BigInt(raw);
  const whole = value / 1000000000000000000n;
  const fraction = (value % 1000000000000000000n)
    .toString()
    .padStart(18, "0")
    .replace(/0+$/, "");
  return whole.toString() + (fraction ? "." + fraction : "");
}

export function renderRoyaltyPayments(record, esc) {
  if (
    record?.chainId !== 1 ||
    !address.test(record.contract || "") ||
    typeof record.tokenId !== "string" ||
    !integer.test(record.tokenId) ||
    !Array.isArray(record.royaltyPayments)
  )
    return "";
  const byEvent = new Map(),
    conflicts = new Set();
  for (const event of record.royaltyPayments) {
    if (
      !event ||
      event.chainId !== 1 ||
      lower(event.contract) !== lower(record.contract) ||
      event.tokenId !== record.tokenId ||
      lower(event.emitter) !== EMITTER ||
      !hash.test(event.transactionHash || "") ||
      !address.test(event.royaltyRecipient || "") ||
      lower(event.royaltyRecipient) === ETH ||
      typeof event.logIndex !== "string" ||
      !integer.test(event.logIndex) ||
      typeof event.royaltyRaw !== "string" ||
      event.royaltyRaw.length > 78 ||
      !integer.test(event.royaltyRaw) ||
      event.decimals !== 18
    )
      continue;
    const currency = lower(event.saleCurrency);
    if (![ETH, WETH].includes(currency)) continue;
    const amount = BigInt(event.royaltyRaw);
    if (amount <= 0n || amount >= 1n << 256n) continue;
    const tx = lower(event.transactionHash),
      key = `1:${tx}:${event.logIndex}`;
    if (event.id !== key) continue;
    const normalized = {
      key,
      tx,
      recipient: lower(event.royaltyRecipient),
      raw: event.royaltyRaw,
      currency,
    };
    const previous = byEvent.get(key);
    if (previous && JSON.stringify(previous) !== JSON.stringify(normalized))
      conflicts.add(key);
    else byEvent.set(key, normalized);
  }
  const events = [...byEvent.values()].filter(
    (event) => !conflicts.has(event.key),
  );
  if (!events.length) return "";
  const summaries = [ETH, WETH].flatMap((currency) => {
    const matching = events.filter((event) => event.currency === currency);
    if (!matching.length) return [];
    const total = matching.reduce((sum, event) => sum + BigInt(event.raw), 0n);
    return [
      {
        currency,
        symbol: currency === ETH ? "ETH" : "WETH",
        count: matching.length,
        total: formatRoyaltyAmount(total.toString()),
      },
    ];
  });
  const short = (value) => `${value.slice(0, 6)}…${value.slice(-4)}`;
  return `<section class="song-revenue" data-royalty-payments aria-label="Recorded royalty payouts"><h2>Recorded royalty payouts</h2>${summaries.map((summary) => `<p><strong>${esc(summary.total)} ${summary.symbol}</strong> · ${summary.count} recorded payout${summary.count === 1 ? "" : "s"}</p>`).join("")}<p>Payments to royalty recipients from selected historical sales. These are not the artist’s net income.</p><details class="artist-sources"><summary>Recipients and transactions</summary><p>Catalog’s March 9, 2026 export, checked against Ethereum receipts. This is a partial history.${summaries.some((summary) => summary.currency === ETH) ? " ETH-denominated payouts can settle as ETH or wrapped ETH (WETH)." : ""}</p>${events.map((event) => `<p>${esc(formatRoyaltyAmount(event.raw))} ${event.currency === ETH ? "ETH" : "WETH"} · <a href="https://etherscan.io/address/${esc(event.recipient)}" title="${esc(event.recipient)}" target="_blank" rel="noopener noreferrer">Recipient ${esc(short(event.recipient))} ↗</a><br><a href="https://etherscan.io/tx/${esc(event.tx)}#eventlog" target="_blank" rel="noopener noreferrer">Transaction ↗</a></p>`).join("")}<a href="https://github.com/catalogworks/catalog-squidward-data" target="_blank" rel="noopener noreferrer">Catalog’s original export ↗</a></details></section>`;
}
