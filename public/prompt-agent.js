import {extractPromptResult} from './prompt-parser.js';
import {connectionMode,connectionHeaders} from './connection-mode.js';
// Retry only read-only operations. Never automatically repeat a paid submission.
const readActions=new Set(['replikator-pricing','replikator-job','pricing','status','spend','job']);
export async function livepeerRequest(action,body={},mode=connectionMode()){
 const attempts=readActions.has(action)?2:1;
 for(let attempt=0;attempt<attempts;attempt++){
  try{
   const r=await fetch('/api/livepeer/'+action,{method:'POST',headers:connectionHeaders(mode),body:JSON.stringify(body),credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(readActions.has(action)?30000:150000)});
   let d;try{d=await r.json()}catch{
    if(r.redirected||[401,403].includes(r.status))throw Object.assign(Error('Your Worklow session needs renewing. Open Worklow in a new tab and sign in, then return here and retry. Your current work is kept.'),{session:true});
    throw Object.assign(Error(`Worklow received an unreadable server response (HTTP ${r.status}). Try again shortly; your current work is kept.`),{transient:true});
   }
   if(!r.ok)throw Object.assign(Error(d.error||`Livepeer request failed (${r.status}).`),{transient:[502,503,504].includes(r.status)});
   return d;
  }catch(e){
   const network=['TimeoutError','AbortError','TypeError'].includes(e.name);
   if(attempt+1<attempts&&(network||e.transient)){await new Promise(resolve=>setTimeout(resolve,750));continue;}
   if(network)throw Error(e.name==='TimeoutError'||e.name==='AbortError'?'Livepeer took too long to respond. Your work is kept; try again shortly.':'Could not reach Livepeer. Check your connection and try again.');
   throw e;
  }
 }
}
export const snapshot=s=>JSON.stringify({src:s.src,scene:s.scene,action:s.action,camera:s.camera,duration:s.duration,blur:s.blur,notes:s.notes,prompts:s.prompts});
export async function agentPrompts(s,targets,{camera,save,onProgress=()=>{}}){
 const mode=connectionMode(),analyse=targets.length===0,initial=snapshot(s);
 // Keep old job metadata for backups, without allowing failed legacy jobs to block new requests.
 if(s.promptTask){s.legacyPromptTask=s.promptTask;delete s.promptTask;await save()}
 let source_url;
 if(analyse){
  if(!s.src)throw Error('Upload a frame first.');
  onProgress('Preparing your frame…');const im=new Image();im.src=s.src;await im.decode();const c=document.createElement('canvas'),scale=Math.min(1,1280/Math.max(im.width,im.height));c.width=Math.round(im.width*scale);c.height=Math.round(im.height*scale);c.getContext('2d').drawImage(im,0,0,c.width,c.height);
  onProgress('Sending frame to Livepeer…');const upload=await livepeerRequest('upload',{data:c.toDataURL('image/jpeg',.84)},mode);source_url=upload.data?.url;if(!source_url)throw Error('Livepeer did not return an uploaded frame URL.');
 }else if(!s.scene?.trim())throw Error('Analyse your frame or enter a description first.');
 onProgress(analyse?'Livepeer is analysing your frame…':'Livepeer is writing your prompt from the analysis…');
 const response=await livepeerRequest('prompts',{source_url,scene:analyse?'':s.scene,action:analyse?'':s.action,camera:analyse?'':camera,notes:analyse?'':s.notes,duration:s.duration,blur:s.blur,targets,request_id:crypto.randomUUID?.()||Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join(''),confirm:true},mode);
 if(response.data?.status!=='completed')throw Error('Livepeer did not finish this request. Your existing work was kept.');
 const output=extractPromptResult(response.data.output,targets,analyse);
 if(snapshot(s)!==initial){s.promptEvidence={status:'result_not_applied',result:output};await save();throw Error('The shot changed during this request. Your edits were kept; the result is preserved in your backup.');}
 const evidence={status:'completed',route:analyse?'direct-vision':'direct-text-from-analysis',completed_at:new Date().toISOString(),...output};
 if(analyse)s.analysisEvidence=evidence;else s.promptEvidence=evidence;
 await save();return output;
}
