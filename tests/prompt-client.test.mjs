import test from 'node:test';
import assert from 'node:assert/strict';
import {agentPrompts} from '../public/prompt-agent.js';
test('generation uses saved analysis without upload, status preflight or old job polling',async()=>{
 const original=globalThis.fetch,calls=[];
 globalThis.fetch=async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return Response.json({data:{status:'completed',output:{scene:'A red square on white.',prompts:{minimax:'0–5s: A red square rotates slowly.'},reference_analyzed:false,limitations:[],models_used:['gemini-text']}}})};
 try{const s={src:'data:image/png;base64,ignored',scene:'A red square on white.',action:'Rotate slowly',duration:5,prompts:{},promptTask:{id:'job_old',snapshot:'old'}};const result=await agentPrompts(s,['minimax'],{camera:'static',save:async()=>{}});assert.equal(calls.length,1);assert.equal(calls[0].url,'/api/livepeer/prompts');assert.equal(calls[0].body.source_url,undefined);assert.equal(calls[0].body.scene,s.scene);assert.equal(s.promptTask,undefined);assert.equal(s.legacyPromptTask.id,'job_old');assert.match(result.prompts.minimax,/rotates/)}finally{globalThis.fetch=original}
});
