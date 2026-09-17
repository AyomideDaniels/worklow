import test from 'node:test';
import assert from 'node:assert/strict';
import {promptTask,extractPromptResult} from '../server/prompts.js';
import worker,{bearer} from '../dist/server/index.js';
const result={scene:'A person by a window',prompts:{minimax:'0–5s: slow push in.'},reference_analyzed:true};
test('task keeps image analysis and revision in text-only scope',()=>{const t=promptTask({source_url:'https://example.com/image.jpg',targets:['minimax'],revision:'Keep camera static',previous:{minimax:'old'}});assert.match(t.prompt,/TEXT ONLY/);assert.match(t.prompt,/Keep camera static/);assert.equal(t.max_iterations,6)});
test('reject unsupported targets, invalid references and empty directions',()=>{for(const body of [{scene:'x',targets:['unknown']},{source_url:'http://example.com/image'},{scene:'x',duration:-1},{}])assert.throws(()=>promptTask(body))});
test('parse completed nested JSON and require image-analysis evidence',()=>{assert.equal(extractPromptResult({output:JSON.stringify(result)},['minimax'],true).prompts.minimax,result.prompts.minimax);assert.throws(()=>extractPromptResult({...result,reference_analyzed:false},['minimax'],true));assert.throws(()=>extractPromptResult(result,['kling'],true))});
const request=(body,origin='https://worklow.test')=>new Request('https://worklow.test/api/livepeer/prompts',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
test('backend rejects other origins and missing credit confirmation',async()=>{assert.equal((await worker.fetch(request({},'https://other.test'),{DAYDREAM_API_KEY:'test'})).status,403);assert.equal((await worker.fetch(request({scene:'x'}),{DAYDREAM_API_KEY:'test'})).status,400)});
test('authenticated backend sends the saved credential only upstream',async()=>{const original=globalThis.fetch;globalThis.fetch=async(url,init)=>{assert.equal(init.headers.Authorization,'Bearer test');return new Response('',{status:401})};try{const r=await worker.fetch(request({scene:'x',targets:['minimax'],confirm:true}),{DAYDREAM_API_KEY:'test'});assert.equal(r.status,502);assert.match((await r.json()).error,/rejected/)}finally{globalThis.fetch=original}});

test('missing secret is rejected before dispatch',async()=>{assert.equal((await worker.fetch(request({scene:'x',confirm:true}),{})).status,503)});

import {directPrompts} from '../server/direct-prompts.js';
test('vision fallback cannot be reported as successful analysis',async()=>{
 await assert.rejects(directPrompts({source_url:'https://example.com/image.png',targets:[]},async()=>({data:{verdict:'indeterminate',score:1,per_asset:[]}})),/could not verify/);
});
test('direct workflow grounds prompts in vision evidence and uses raw text capability',async()=>{
 const calls=[];const output=await directPrompts({source_url:'https://example.com/image.png',targets:['minimax'],duration:5},async(name,args,surface)=>{
 calls.push(name);if(name==='critique_batch')return {data:{verdict:'ship',per_asset:[{url:'https://example.com/image.png',note:'A red square in the centre of a white background.'}]}};
 assert.equal(surface,'raw');assert.match(args.prompt,/red square/);return {data:{ok:true,result:{text:JSON.stringify({scene:'model paraphrase',prompts:{minimax:'0–5s: rotate the red square.'}})}}};});
 assert.deepEqual(calls,['critique_batch','run_capability']);assert.equal(output.data.output.reference_analyzed,true);assert.match(output.data.output.scene,/red square/);
});

test('billing combines client ID with a bare key and preserves composite keys',()=>{assert.equal(bearer({DAYDREAM_API_KEY:' pmth_test ',PYMTHOUSE_CLIENT_ID:'app_example'}),'app_example_pmth_test');assert.equal(bearer({DAYDREAM_API_KEY:'app_example_pmth_test',PYMTHOUSE_CLIENT_ID:'app_other'}),'app_example_pmth_test')});
