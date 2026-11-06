import {readNFT,storageURL} from '../src/nft-reader.mjs';
import {nftCatalog} from '../src/nft-catalog.js';
import '../src/data.js';
import {writeFileSync} from 'node:fs';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
await mkdir('public/recovered',{recursive:true});
let snapshot={};try{snapshot=JSON.parse(await readFile('data/recovery-snapshot.json','utf8'))}catch{}
const priority=['record-69c77ef0','record-not4me','record-e6516778','record-28b708ee','record-b31b7bac','park-sound-rainwater','park-sound-do-it','record-00396a23'];
const records=[...nftCatalog].sort((a,b)=>(priority.includes(b.id)?1:0)-(priority.includes(a.id)?1:0));
let cursor=0;
async function worker(){while(cursor<records.length){const r=records[cursor++];if(snapshot[r.id]?.status==='live')continue;const v=await readNFT(r);snapshot[r.id]=v;
if(v.status==='live'&&v.imageURL){try{const res=await fetch(v.imageURL,{signal:AbortSignal.timeout(10000)});if(res.ok && /^image\//.test(res.headers.get('content-type')||'')){const b=Buffer.from(await res.arrayBuffer());if(b.length<8000000){await writeFile(`public/recovered/${r.id}.img`,b);v.localImage=`/recovered/${r.id}.img`;v.imageType=res.headers.get('content-type');}}}catch{}}
writeFileSync('data/recovery-snapshot.json',JSON.stringify(snapshot,null,2));console.log(`${cursor}/${records.length} ${v.status} ${r.artist} — ${r.title.slice(0,45)}`);
}}
await Promise.all(Array.from({length:2},worker));console.log('COMPLETE',Object.values(snapshot).filter(x=>x.status==='live').length,'/',records.length);
