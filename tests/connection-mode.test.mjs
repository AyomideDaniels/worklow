import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
test('keyless omits authorization, works without a key, and account mode still uses the saved key',async()=>{
 const original=globalThis.fetch,seen=[];
 globalThis.fetch=async(url,options)=>{seen.push(options.headers);return Response.json({result:{structuredContent:{total:1},content:[]}})};
 const request=mode=>new Request('https://worklow.test/api/livepeer/status',{method:'POST',headers:{Origin:'https://worklow.test','Content-Type':'application/json','X-Worklow-Mode':mode},body:'{}'});
 try{
  for(const env of [{},{DAYDREAM_API_KEY:'pmth_secret',PYMTHOUSE_CLIENT_ID:'app_test'}]){
   const response=await worker.fetch(request('keyless'),env);assert.equal(response.status,200);assert.equal((await response.json()).mode,'keyless');assert.equal(Object.hasOwn(seen.at(-1),'Authorization'),false);
  }
  const response=await worker.fetch(request('pymthouse'),{DAYDREAM_API_KEY:'pmth_secret',PYMTHOUSE_CLIENT_ID:'app_test'});assert.equal(response.status,200);assert.equal(seen.at(-1).Authorization,'Bearer app_test_pmth_secret');
  assert.equal((await worker.fetch(request('invalid'),{})).status,400);
  assert.equal((await worker.fetch(request('pymthouse'),{})).status,503);
 }finally{globalThis.fetch=original}
});
