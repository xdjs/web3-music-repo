import { writeFile } from "node:fs/promises";
const origin = "https://works.fridaysatthepark.org";
const listing = await (await fetch(origin + "/onchain")).text();
const paths = [
  ...new Set(
    [...listing.matchAll(/href="(\/track\/[^"?#]+)"/g)].map((m) => m[1]),
  ),
];
const records = [],
  errors = [];
function objects(html) {
  const chunks = [
    ...html.matchAll(/self\.__next_f\.push\((\[.*?\])\)<\/script>/g),
  ]
    .map((m) => JSON.parse(m[1]))
    .filter((v) => typeof v[1] === "string")
    .map((v) => v[1])
    .join("");
  const found = [];
  function walk(o) {
    if (!o || typeof o !== "object") return;
    if (o.contractAddress && o.title) found.push(o);
    Object.values(o).forEach(walk);
  }
  for (const line of chunks.split("\n")) {
    try {
      walk(JSON.parse(line.slice(line.indexOf(":") + 1)));
    } catch {}
  }
  return found;
}
for (let i = 0; i < paths.length; i += 4) {
  const batch = await Promise.allSettled(
    paths.slice(i, i + 4).map(async (path) => {
      const res = await fetch(origin + path, {
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw Error(`${path}: ${res.status}`);
      const candidates = objects(await res.text());
      const slug = path.split("/").pop();
      const record = candidates.find((r) => r.slug === slug || r.id === slug);
      if (!record) throw Error(`${path}: no matching public record`);
      return { ...record, evidenceURL: origin + path };
    }),
  );
  for (const result of batch)
    result.status === "fulfilled"
      ? records.push(result.value)
      : errors.push(String(result.reason));
  console.log(
    `${Math.min(i + 4, paths.length)}/${paths.length} pages; ${records.length} records`,
  );
  await writeFile(
    new URL("../data/the-park-site-inventory.json", import.meta.url),
    JSON.stringify(
      {
        source: origin + "/onchain",
        checkedAt: new Date().toISOString(),
        pages: paths.length,
        records,
        errors,
      },
      null,
      2,
    ),
  );
}
