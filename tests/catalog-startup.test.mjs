import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

test("server initialization defers catalog hydration until request handling", () => {
  const probe = `
    import fs from 'node:fs';
    import {syncBuiltinESMExports} from 'node:module';
    const original=fs.readFileSync;
    let catalogReads=0;
    fs.readFileSync=function(file,...args){
      if(String(file).endsWith('data/audio-analysis.json')){
        catalogReads++;
      }
      return original.call(this,file,...args);
    };
    syncBuiltinESMExports();
    const {handler}=await import('./server.mjs');
    const before=catalogReads;
    let status=200,body='';
    await handler({url:'/api/record/spinamp-684d3abc750a94093e6a',method:'GET',headers:{host:'localhost'}},{
      setHeader(){},writeHead(code){status=code},end(value){body=String(value||'')}
    });
    console.log(JSON.stringify({before,catalogReads,status,record:JSON.parse(body).record?.id}));
  `;
  const result = JSON.parse(
    execFileSync(process.execPath, ["--input-type=module", "-e", probe], {
      cwd: process.cwd(),
      encoding: "utf8",
      timeout: 30000,
    }),
  );
  assert.equal(
    result.before,
    0,
    "Catalog was loaded during module initialization",
  );
  assert.ok(
    result.catalogReads > 0,
    "Handler never attempted catalog hydration",
  );
  assert.equal(result.status, 200);
  assert.equal(result.record, "spinamp-684d3abc750a94093e6a");
});
