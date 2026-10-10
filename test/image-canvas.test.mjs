import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync('public/image-canvas.html','utf8');
const index=fs.readFileSync('public/index.html','utf8');
const app=fs.readFileSync('public/app.js','utf8');
test('Image Canvas embedded and navigable',()=>{
 assert.match(index,/id="canvasNav"/);
 assert.match(index,/id="canvasMain"/);
 assert.match(index,/data-src="\.\/image-canvas\.html"/);
 assert.match(app,/canvasNav\.addEventListener\('click'/);
});
test('Image Canvas browser script parses',()=>{
 const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
 assert.ok(scripts.length>0);
 for(const s of scripts)new vm.Script(s[1],{filename:'image-canvas.html'});
});
test('Image Canvas includes required controls and persistence',()=>{
 for(const id of ['wr','wn','hr','hn','stage','items','picker','export','backup','restore','fit','plus','minus'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/e\.button===1/);
 assert.match(html,/indexedDB\.open\('worklow-image-canvas'/);
 assert.match(html,/clipboardData/);
 assert.match(html,/dataTransfer\.files/);
 assert.match(html,/toBlob/);
});
test('Image Canvas packaged in built app',()=>{
 const output=fs.readFileSync('dist/server/assets.js','utf8');
 assert.match(output,/"\/image-canvas\.html"/);
});
