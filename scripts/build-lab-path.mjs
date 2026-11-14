import { readdir, readFile, writeFile, mkdir, cp } from "node:fs/promises";
import path from "node:path";
import { LAB_PATH, labText, labData } from "../src/lab-path.mjs";
// Snapshot before creating the copy, so it cannot recursively include itself.
const entries = await readdir("dist");
const target = "dist" + LAB_PATH;
await mkdir(target, {recursive:true});
const shared = new Set(["media", "people", "collectors", "recovered", "social"]);
for (const name of entries.filter(name => !shared.has(name))) await cp(path.join("dist",name),path.join(target,name),{recursive:true});
async function transform(dir) {
 for (const entry of await readdir(dir,{withFileTypes:true})) {
  const file=path.join(dir,entry.name);
  if(entry.isDirectory()) {await transform(file);continue;}
  if(!/\.(html|js|mjs|css|json)$/.test(file)) continue;
  const source=await readFile(file,"utf8");
  let output=file.endsWith(".json") ? JSON.stringify(labData(JSON.parse(source))) : labText(source);
  if(file.endsWith(".html")) output=output.replaceAll("https://web3-music-archive.vercel.app", "https://lab.musicnerd.net"+LAB_PATH);
  await writeFile(file,output);
 }
}
await transform(target);
console.log("Lab static frontend ready at " + LAB_PATH);
