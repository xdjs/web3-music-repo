import fs from "node:fs";
const modern = JSON.parse(fs.readFileSync("data/sound-expanded.json"));
const fallback = JSON.parse(fs.readFileSync("data/sound-fallback.json"));
const all = { ...modern.attempts };
for (const [k, v] of Object.entries(fallback.attempts))
  if (all[k]?.status !== "live") all[k] = v;
const collectionMap = new Map();
for (const name of ["1-1", "2-1", "1-10", "2-10"]) {
  const s = JSON.parse(fs.readFileSync("data/census/" + name + ".json"));
  for (const c of s.collections)
    collectionMap.set(s.chainId + ":" + c.contract, {
      ...c,
      chainId: s.chainId,
      factory: s.factory,
      factoryVersion: s.version,
    });
}
const jobs = [];
for (const chain of [1, 10]) {
  const a = Object.entries(all).filter(
    ([k, v]) => k.startsWith(chain + ":") && v.status === "unavailable",
  );
  for (let i = 0; i < 6; i++)
    jobs.push(a[Math.floor((i * (a.length - 1)) / 5)]);
}
jobs.push(
  ...Object.entries(all)
    .filter(([k, v]) => v.status === "unminted")
    .filter((_, i) => i % 1000 === 0)
    .slice(0, 3),
);
fs.writeFileSync(
  "data/sound-resolution/sample-input.json",
  JSON.stringify(
    {
      scope:
        "Twelve unresolved contracts spaced across ordered ETH/OP lists, plus three unminted controls. Not a random or exhaustive sample.",
      records: jobs.map(([key, prior]) => ({
        key,
        ...collectionMap.get(key),
        prior,
      })),
    },
    null,
    2,
  ) + "\n",
);
