import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import assert from "node:assert/strict";

// Exercise actual handlers with only the deployed data allowlist present.
// No listening socket, network request, private storage, or credentials needed.
if (process.argv.includes("--probe")) {
  globalThis.fetch = async () => {
    throw Error("Unexpected network access in runtime bundle check");
  };
  const { handler, buildCatalogPayload } = await import(
    pathToFileURL(path.resolve("server.mjs"))
  );
  const { createCatalogLoader } = await import(
    pathToFileURL(path.resolve("src/catalog-bundle.mjs"))
  );
  const bundle = createCatalogLoader()();
  const sha = (body) => createHash("sha256").update(body).digest("hex");
  const results = {
    records: bundle.records.length,
    people: bundle.people.length,
    indexSha256: sha(JSON.stringify(buildCatalogPayload(bundle, true))),
    evidenceSha256: sha(JSON.stringify(bundle.evidence)),
    routes: [],
  };
  const indexed = bundle.records.find(
    (record) => record.assetType === "indexed-release",
  );
  const routes = [
    "/api/coverage",
    "/api/coverage/sound-reconciliation",
    "/api/archive",
  ];
  if (indexed)
    routes.push(
      `/api/record/${indexed.id}`,
      `/share/record/${indexed.id}`,
      `/api/collectors/${indexed.id}`,
    );
  for (const url of routes) {
    let body,
      status = 200;
    const req = {
      method: "GET",
      url,
      headers: { host: "web3-music-archive.vercel.app" },
    };
    const res = {
      setHeader() {},
      writeHead(value) {
        status = value;
      },
      end(value) {
        body = value || "";
      },
    };
    await handler(req, res);
    assert.equal(status, 200, `${url} returned ${status}`);
    results.routes.push({ url, status, sha256: sha(body) });
  }
  console.log(JSON.stringify(results));
} else {
  const root = process.cwd();
  const config = JSON.parse(readFileSync("vercel.json", "utf8"));
  const include = config.functions["api/index.mjs"].includeFiles;
  assert.match(include, /^\{[^*]+\}$/);
  const files = include.slice(1, -1).split(",");
  const stage = mkdtempSync(path.join(tmpdir(), "music-runtime-"));
  const script = fileURLToPath(import.meta.url);
  const probe = (cwd) =>
    JSON.parse(
      execFileSync(process.execPath, [script, "--probe"], {
        cwd,
        encoding: "utf8",
        maxBuffer: 1024 * 1024,
        timeout: 120000,
      }),
    );
  try {
    let dataBytes = 0;
    const omitted = [];
    for (const file of files) {
      if (!existsSync(file)) {
        omitted.push(file);
        continue;
      }
      const target = path.join(stage, file);
      mkdirSync(path.dirname(target), { recursive: true });
      cpSync(file, target);
      dataBytes += statSync(file).size;
    }
    for (const file of ["server.mjs", "src", "api", "scripts", "package.json"])
      cpSync(file, path.join(stage, file), { recursive: true });
    symlinkSync(
      path.join(root, "node_modules"),
      path.join(stage, "node_modules"),
      "dir",
    );
    const full = probe(root),
      slim = probe(stage);
    assert.deepEqual(
      slim,
      full,
      "Runtime allowlist changed catalog, evidence, or public route responses",
    );
    const result = {
      checkedAt: new Date().toISOString(),
      status: "passed",
      includedFiles: files.length,
      dataBytes,
      omittedOptionalFiles: omitted,
      ...slim,
      scope:
        "Exact public catalog/evidence hashes and handler response parity using only allowlisted runtime data; no network or account authentication claims. Actual deployed function size must also be checked.",
    };
    writeFileSync(
      "data/runtime-bundle-verification.json",
      JSON.stringify(result, null, 2) + "\n",
    );
    console.log(JSON.stringify(result));
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}
