import { build } from "esbuild";
import { mkdir, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const outdir = path.resolve("public/account");
// Finish the entire build before replacing any served asset. A failed compile
// leaves the previous login interface intact.
const result = await build({
  entryPoints: ["src/account-login.jsx"],
  outdir,
  bundle: true,
  format: "esm",
  splitting: true,
  minify: true,
  define: { "process.env.NODE_ENV": '"production"' },
  target: ["es2022"],
  logLevel: "warning",
  write: false,
});
await mkdir(outdir, { recursive: true });
const current = new Set(
  result.outputFiles.map((file) => path.basename(file.path)),
);
// Chunks land before the entry so a freshly loaded entry always has its imports.
for (const file of result.outputFiles.sort(
  (a, b) =>
    Number(path.basename(a.path) === "account-login.js") -
    Number(path.basename(b.path) === "account-login.js"),
)) {
  await writeFile(file.path + ".tmp", file.contents);
  await rename(file.path + ".tmp", file.path);
}
for (const name of await readdir(outdir)) {
  if (/\.js(?:\.map)?$/.test(name) && !current.has(name))
    await rm(path.join(outdir, name));
}
console.log(`Account interface built (${current.size} generated assets)`);
