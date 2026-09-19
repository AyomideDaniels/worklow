import { assets } from './assets.js';
import {replikator,replikatorModel} from './replikator.js';
import {directPrompts} from './direct-prompts.js';
const redact=(text,env)=>env.DAYDREAM_API_KEY?text.split(env.DAYDREAM_API_KEY).join('[redacted]'):text;
const endpoint='https://agent.livepeer.org/api/mcp/creative';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
async function archiveImage(value){
 let u;try{u=new URL(value)}catch{throw Error('Invalid generated image URL.')}
 if(u.protocol!=='https:'||u.hostname!=='agent.livepeer.org'||!u.pathname.startsWith('/a/')||u.username||u.password||u.port)throw Error('Invalid generated image URL.');
 let response;const signal=AbortSignal.timeout(60000);
 for(let hop=0;hop<4;hop++){
  response=await fetch(u.href,{redirect:'manual',signal});
  if(![301,302,303,307,308].includes(response.status))break;
  const location=response.headers.get('Location');await response.body?.cancel();
  if(!location)throw Error('Generated image redirect is missing.');
  u=new URL(location,u);
  if(u.protocol!=='https:'||u.username||u.password||u.port||!(u.hostname==='agent.livepeer.org'||u.hostname==='fal.media'||u.hostname.endsWith('.fal.media')||u.hostname==='7y4flzpulgv4co6r.public.blob.vercel-storage.com'))throw Error('Unsupported generated image host.');
 }
 if(!response.ok)throw Error('The generated image could not be downloaded. Please retry.');
 const type=response.headers.get('Content-Type')?.split(';')[0];const limit=20*1024*1024;
 if(!['image/png','image/jpeg','image/webp'].includes(type)||Number(response.headers.get('Content-Length')||0)>limit){await response.body?.cancel();throw Error('Unsupported or oversized generated image.');}
 const reader=response.body.getReader(),parts=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw Error('Generated image exceeds 20 MB.');}parts.push(value);}
 return new Response(new Blob(parts,{type}),{headers:{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
export function bearer(env){const key=env.DAYDREAM_API_KEY?.trim()||'';const client=env.PYMTHOUSE_CLIENT_ID?.trim();return key.startsWith('pmth_')&&client?client+'_'+key:key;}
export async function diagnoseAuth(env){
 const key=env.DAYDREAM_API_KEY.trim(),configured=bearer(env);
 const variants=[['configured',configured]];
 if(key.startsWith('pmth_')&&configured!==key)variants.push(['bare',key]);
 const checks=[];
 for(const surface of ['creative','raw'])for(const [format,token] of variants){
  try{
   const res=await fetch('https://agent.livepeer.org/api/mcp/'+surface,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json, text/event-stream','Authorization':'Bearer '+token},body:JSON.stringify({jsonrpc:'2.0',id:crypto.randomUUID(),method:'tools/list',params:{}}),signal:AbortSignal.timeout(20000)});
   const raw=await res.text();let packet;
   try{packet=JSON.parse(raw)}catch{for(const line of raw.split('\n'))if(line.startsWith('data:')){try{const p=JSON.parse(line.slice(5));if(p.result||p.error)packet=p}catch{}}}
   checks.push({surface,format,http_status:res.status,tools_available:Array.isArray(packet?.result?.tools),tool_count:packet?.result?.tools?.length??0,rpc_error_code:typeof packet?.error?.code==='number'?packet.error.code:null});
  }catch{checks.push({surface,format,error:'Connection timed out or could not be completed.'})}
 }
 return {key_format:key.startsWith('pmth_')?'bare-pymthouse':key.startsWith('app_')?'composite':key.startsWith('sk_')?'daydream':'unrecognized',client_id_present:!!env.PYMTHOUSE_CLIENT_ID?.trim(),checks};
}
export async function rpc(env,name,args,surface='creative'){
 const res=await fetch(surface==='raw'?'https://agent.livepeer.org/api/mcp/raw':endpoint,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json, text/event-stream',...(env.WORKLOW_KEYLESS?{}:{'Authorization':'Bearer '+bearer(env)})},body:JSON.stringify({jsonrpc:'2.0',id:crypto.randomUUID(),method:'tools/call',params:{name,arguments:args}}),signal:AbortSignal.timeout(90000)});
 if(!res.ok)throw Error(res.status===401||res.status===403?`Livepeer rejected the saved PymtHouse credential (HTTP ${res.status}).`:`Livepeer returned HTTP ${res.status}. Please try again later.`);
 const raw=await res.text();let packet;
 try{packet=JSON.parse(raw)}catch{for(const line of raw.split('\n')){if(line.startsWith('data:')){try{const p=JSON.parse(line.slice(5));if(p.result||p.error)packet=p}catch{}}}}
 if(!packet)throw Error('Livepeer returned an unreadable response.');
 if(packet.error)throw Error(packet.error.message||'Livepeer request failed.');
 const result=packet.result||{};const text=(result.content||[]).filter(c=>c.type==='text').map(c=>c.text).join('\n');
 if(result.isError){
  if(name==='get_create_media'&&/Media job mjob_[a-z0-9]+:\s*(failed|cancelled)\b/i.test(text))return {data:{status:'failed',error:/content_policy_violation|flagged by a content checker/i.test(text)?'The provider rejected this request: content_policy_violation.':'The image provider could not complete this render.'}};
  throw Error(text||'Livepeer could not complete this request.');
 }
 let data=result.structuredContent;
 if(!data){try{data=JSON.parse(text)}catch{data={}}}
 return {data,text};
}
export default {async fetch(request,env){
 const url=new URL(request.url);
 if(!url.pathname.startsWith('/api/livepeer/')){
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
  const a=assets[url.pathname==='/'?'/index.html':url.pathname];
  if(!a)return new Response('Not found',{status:404});
  return new Response(request.method==='HEAD'?null:a.body,{headers:{'Content-Type':a.type,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'}});
 }
 if(request.method!=='POST')return json({error:'Method not allowed'},405);
 if(request.headers.get('Origin')!==url.origin || !request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'Use the Worklow app to make this request.'},403);

 const mode=request.headers.get('X-Worklow-Mode')||'pymthouse';
 if(!['keyless','pymthouse'].includes(mode))return json({error:'Choose Keyless or PymtHouse in Settings.'},400);
 env={...env,WORKLOW_KEYLESS:mode==='keyless'};
 if(!env.WORKLOW_KEYLESS&&!env.DAYDREAM_API_KEY?.trim())return json({error:'Save the PymtHouse key in DAYDREAM_API_KEY in site settings, or choose Keyless in Settings.'},503);
 try{
  if(Number(request.headers.get('Content-Length')||0)>3000000)return json({error:'Reference too large.'},413);
  const bodyText=await request.text();if(bodyText.length>3000000)return json({error:'Reference too large.'},413);
  const body=JSON.parse(bodyText);let result;
  switch(url.pathname){
   case '/api/livepeer/auth-diagnostics':return json(await diagnoseAuth(env));
   case '/api/livepeer/replikator-image':return await archiveImage(body.url);
   case '/api/livepeer/replikate':result=await replikator(body,(name,args,surface)=>rpc(env,name,args,surface));break;
   case '/api/livepeer/replikator-pricing':result=await rpc(env,'get_pricing',{name:replikatorModel});break;
   case '/api/livepeer/replikator-job':
    if(!/^mjob_[a-z0-9]{6,32}$/.test(body.job_id||''))return json({error:'Invalid image job ID.'},400);
    result=await rpc(env,'get_create_media',{job_id:body.job_id});break;
   case '/api/livepeer/status':result=await rpc(env,'list_capabilities',{limit:1});return json({connected:true,mode,total:result.data.total??null});
   case '/api/livepeer/pricing':result=await rpc(env,'get_pricing',{});break;
   case '/api/livepeer/spend':result=await rpc(env,'get_cost_report',{scope:'mine',since:'24h'});break;
   case '/api/livepeer/upload':
    if(typeof body.data!=='string'||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(body.data))return json({error:'Choose a PNG, JPEG, or WebP reference.'},400);
    result=await rpc(env,'upload',{data:body.data,kind:'image',filename:'worklow-reference.jpg'});break;
   case '/api/livepeer/prompts':
    if(body.confirm!==true)return json({error:'Confirm use of Livepeer account credits.'},400);
    if(body.request_id&&!/^[A-Za-z0-9_-]{1,128}$/.test(body.request_id))return json({error:'Invalid request ID.'},400);
    result=await directPrompts(body,(name,args,surface)=>rpc(env,name,args,surface));break;
   case '/api/livepeer/run':
    if(body.confirm!==true)return json({error:'Confirm that this task can use your Livepeer account credits.'},400);
    if(typeof body.prompt!=='string'||!body.prompt.trim()||body.prompt.length>7800)return json({error:'Enter a task under 7,800 characters.'},400);
    result=await rpc(env,'submit_agent_task',{prompt:body.prompt,max_iterations:10,max_wall_clock_seconds:280});break;
   case '/api/livepeer/job':
    if(!/^job_[a-z0-9]{6,32}$/.test(body.job_id||''))return json({error:'Invalid agent task ID.'},400);
    result=await rpc(env,'get_agent_task',{job_id:body.job_id,tail:40});break;
   default:return json({error:'Not found'},404);
  }
  // Never return the configured credential, even if an upstream error echoes it.
  const clean=redact(JSON.stringify(result),env);return new Response(clean,{headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 }catch(e){const message=redact(String(e.message||'Connection failed.'),env);return json({error:message.slice(0,1500)},502)}
}};
