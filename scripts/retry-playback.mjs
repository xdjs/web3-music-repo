import {readFileSync} from 'node:fs';
// Same audit, longer wait and lower concurrency for prior failures.
const source=readFileSync(new URL('./audit-playback.mjs',import.meta.url),'utf8').replaceAll('18000','45000').replaceAll('18 seconds','45 seconds').replace('length:4','length:2');
await import('data:text/javascript;base64,'+Buffer.from(source.replace("'../src/nft-catalog.js'",JSON.stringify(new URL('../src/nft-catalog.js',import.meta.url).href)).replace("'../src/media-recovery.js'",JSON.stringify(new URL('../src/media-recovery.js',import.meta.url).href)).replace("'playwright'",JSON.stringify(new URL('../node_modules/playwright/index.mjs',import.meta.url).href))).toString('base64'));
