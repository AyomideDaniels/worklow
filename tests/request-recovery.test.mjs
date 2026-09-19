import test from 'node:test';
import assert from 'node:assert/strict';
import {livepeerRequest} from '../public/prompt-agent.js';
import {setupReplikator} from '../public/replikator.js';
test('read retries recover but paid submissions are never automatically repeated',async()=>{
 const original=globalThis.fetch;let calls=0;
 try{
  globalThis.fetch=async()=>++calls===1?new Response('<html>Temporary gateway failure</html>',{status:502}):Response.json({data:{ok:true}});
  assert.deepEqual(await livepeerRequest('replikator-pricing',{},'keyless'),{data:{ok:true}});assert.equal(calls,2);
  calls=0;globalThis.fetch=async()=>{calls++;return new Response('unavailable',{status:502});};
  await assert.rejects(livepeerRequest('replikate',{request_id:'keep-me'},'keyless'),/unreadable/);assert.equal(calls,1);
  calls=0;globalThis.fetch=async()=>{calls++;return new Response('Sign in',{status:401});};
  await assert.rejects(livepeerRequest('replikator-pricing',{},'keyless'),/session needs renewing/);assert.equal(calls,1);
 }finally{globalThis.fetch=original;}
});
test('failed pricing stays retryable and a retry recovers without submitting a render',async()=>{
 const original={fetch:globalThis.fetch,document:globalThis.document,window:globalThis.window};
 const nodes=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',hidden:false,disabled:false,removeAttribute(){}});return nodes.get(id);};
 globalThis.document={getElementById:node,addEventListener(){}};globalThis.window={addEventListener(){}};
 let healthy=false,renders=0;
 globalThis.fetch=async url=>{
  if(url.endsWith('/replikator-pricing'))return healthy?Response.json({data:{capabilities:[{name:'gpt-image-edit',display_price_usd:.23,unit_kind:'image'}]}}):Response.json({error:'Pricing offline'},{status:400});
  if(url.endsWith('/replikate'))renders++;
  return Response.json({error:'Upload offline'},{status:400});
 };
 try{
  setupReplikator({state:{replikator:{source:'data:image/png;base64,AAAA'}},save:async()=>{},show(){},addToStoryboard(){}});
  await node('replikateBtn').onclick();
  assert.equal(node('replikateBtn').disabled,false);assert.equal(node('replikateBtn').textContent,'Retry connection');assert.equal(renders,0);
  healthy=true;await node('replikateBtn').onclick();
  assert.equal(node('replikateBtn').disabled,false);assert.equal(node('replikateBtn').textContent,'Replikate');assert.match(node('replikatorPrice').textContent,/0.230/);assert.equal(renders,0);
 }finally{Object.assign(globalThis,original);}
});
