import {test} from "node:test";
import assert from "node:assert/strict";
import {LAB_PATH,labText,labData,stripLabPath} from "../src/lab-path.mjs";
test("Lab assets, API requests, shares and account links stay in their prefix",()=>{
 for(const route of ["/src/app.js","/api/catalog?view=index","/media/cover.jpg","/share/mix/abc","/#me"])
  assert.equal(labText(JSON.stringify(route)),JSON.stringify(LAB_PATH+route));
 assert.equal(labText('url("/media/font.ttf")'),'url("'+LAB_PATH+'/media/font.ttf")');
 for(const value of ['"https://provider.example/api/song"','"//provider.example/media/song"','"#/listen"','"'+LAB_PATH+'/src/app.js"']) assert.equal(labText(value),value);
 assert.equal(stripLabPath(LAB_PATH+'/api/record/42'),'/api/record/42');
 assert.equal(stripLabPath('/api/record/42'),'/api/record/42');
 assert.equal(stripLabPath(LAB_PATH+'-other/api'),LAB_PATH+'-other/api');
 assert.deepEqual(labData({cover:'/media/cover.jpg',audio:'https://provider.example/song.mp3'}),{cover:LAB_PATH+'/media/cover.jpg',audio:'https://provider.example/song.mp3'});
});

test("preserve metadata, SDK regexes and all responsive image candidates",()=>{
 assert.equal(labData({title:"/Free (Demo) - Limited", name:"/favorites"}).name,"/favorites");
 assert.equal(labData({title:"/Free (Demo) - Limited"}).title,"/Free (Demo) - Limited");
 assert.equal(labText("var N=/#/g"),"var N=/#/g");
 assert.equal(labText('srcset="/people/a.webp 160w, /people/b.webp 640w"'),'srcset="'+LAB_PATH+'/people/a.webp 160w, '+LAB_PATH+'/people/b.webp 640w"');
});
