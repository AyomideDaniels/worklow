import {setupGallery} from './replikator-gallery.js';
import {livepeerRequest} from './prompt-agent.js?v=16';
import {gtaStyle,validateProfiles} from './style-profiles.js';
import {gtaAnchors} from './gta-anchors.js';
import {parseProfileFiles,prepareImage} from './profile-import.js';
const $=id=>document.getElementById(id);
const uuid=()=>crypto.randomUUID?.()||Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function setupReplikator({state,save,show,addToStoryboard}){
 const gallery=setupGallery({state,save,addToStoryboard});
 let working=false,polling=false,rate=null,draftAnchors=[],draftDescription='';
 const record=()=>state.replikator||(state.replikator={});
 const styles=()=>[{...gtaStyle,anchors:gtaAnchors},...(state.replikatorProfiles||[])];
 const selected=()=>styles().find(p=>p.id===state.replikatorStyle)||styles()[0];
 const status=text=>$('replikatorStatus').textContent=text;
 async function failure(error,terminal=false){
  const message=String(error?.message||error||'Image generation failed.');
  const rejected=/content_policy_violation|flagged by a content checker/i.test(message);
  terminal=terminal||rejected||/Media job mjob_[a-z0-9]+:\s*(failed|cancelled)\b/i.test(message);
  const r=record();
  if(terminal){
   const job=r.job_id||message.match(/mjob_[a-z0-9]+/)?.[0];
   r.job_id=null;r.request_id=null;r.request=null;r.source_url=null;
   r.lastError=rejected?'The image provider declined this request through its content checker. Try a different reference or review your style profile.': 'The image provider could not complete this render. You can try again.';
   if(job)r.lastError+=' Support reference: '+job+'.';
   try{await save();}catch{r.lastError+=' The reset could not be saved; keep this page open.';}
   status(r.lastError);
  }else status(r.job_id?'Could not check the render. Click Retry / check generation to check the same job.':r.request_id?'Could not confirm the render. Click Retry / check generation to recover the same request.':message.slice(0,250));
 }
 function draw(){
  const r=record(),style=selected(),locked=working||!!r.job_id;
  $('replikatorStyles').innerHTML=styles().map(p=>`<button class="replikator-style" data-style="${esc(p.id)}" aria-pressed="${p.id===style.id}" ${locked?'disabled':''}>${p.anchors?.[0]?`<img src="${p.anchors[0]}" alt="">`:'<span class="replikator-profile-symbol" aria-hidden="true">◧</span>'}<strong>${esc(p.title)}</strong><small>${p.id==='gta-vi'?'In-game 3D · bloom':'Imported profile'}</small></button>`).join('')+`<button class="replikator-style add-style" id="addReplikatorStyle" ${locked?'disabled':''}><b aria-hidden="true">＋</b>Add style</button>`;
  $('replikatorStyleDescription').textContent=style.description||'Applies your imported visual profile while preserving the source scene.';
  for(const [id,src] of [['replikatorSource',r.source],['replikatorResult',gallery.source(r.url)||r.url]]){const im=$(id);im.hidden=!src;if(src)im.src=src;else im.removeAttribute('src');}
  $('replikatorResultTitle').textContent=(r.url?r.resultStyle||'Previous result':style.title)+' version';
  $('replikatorPlaceholder').hidden=!!r.url;$('replikatorDownload').hidden=!r.url;if(r.url)$('replikatorDownload').href=gallery.source(r.url)||r.url;
  $('replikateBtn').disabled=working||!r.source||(!r.job_id&&rate===null);
  $('replikateBtn').textContent=working?'Replikating…':r.job_id||r.request_id?'Retry / check generation':'Replikate';
  $('resetReplikator').hidden=working||!(r.job_id||r.request_id);
  $('replikatorFile').disabled=locked;
 }
 async function pricing(){try{
  const response=await livepeerRequest('replikator-pricing',{});const row=response.data?.capabilities?.find(r=>r.name==='gpt-image-edit');
  if(typeof row?.display_price_usd!=='number'||row.unit_kind!=='image'||row.display_price_usd<=0||row.display_price_usd>0.75)throw Error('Image pricing is unavailable or exceeds the $0.75 limit.');
  rate=row.display_price_usd;$('replikatorPrice').textContent=`Estimated $${rate.toFixed(3)} / image · usually 1–3 minutes · uses account credits`;
 }catch(e){rate=null;$('replikatorPrice').textContent=e.message;}draw();}
 async function finish(data){
  const r=record(),url=data.url||data.run_output?.url;
  if(url){const u=new URL(url);if(u.protocol!=='https:')throw Error('Invalid image result URL.');r.url=u.href;r.resultStyle=r.pendingStyle||selected().title;r.job_id=null;r.request_id=null;r.request=null;r.completedAt=new Date().toISOString();await save();status('Saving your image to the gallery…');const archived=await gallery.add(r);status(archived?'Saved to the gallery below. Choose Save to storyboard to create video prompts.':'Image added below. Save its local copy before the provider link expires.');return true;}
  if(['failed','cancelled'].includes(data.status)){await failure(typeof data.error==='string'?data.error:data.error?.message||'Image generation failed.',true);return true;}return false;
 }
 async function poll(){if(polling)return;polling=true;working=true;draw();try{
  for(let n=0;n<90;n++){const r=record();if(!r.job_id)break;status(`Creating your ${r.pendingStyle||selected().title} version… You can leave this page and return.`);const reply=await livepeerRequest('replikator-job',{job_id:r.job_id});if(await finish(reply.data||{}))break;await new Promise(resolve=>setTimeout(resolve,5000));}
  if(record().job_id)status('Still rendering. Click Retry / check generation to check the same job without starting another render.');
 }catch(e){await failure(e);}finally{polling=false;working=false;draw();}}
 $('replikatorNav').onclick=()=>{show();draw();gallery.draw();pricing();if(record().job_id)poll();else if(record().url)gallery.add(record()).then(draw).catch(e=>status(e.message));};
 $('replikatorStyles').onclick=async e=>{
  if(working||record().job_id)return;
  if(e.target.closest('#addReplikatorStyle')){draftAnchors=[];draftDescription='';for(const id of ['styleProfileName','styleProfileText','styleProfileFiles','styleProfileImages'])$(id).value='';$('styleProfileStatus').textContent='';$('styleProfileDialog').showModal();return;}
  const b=e.target.closest('[data-style]');if(b){state.replikatorStyle=b.dataset.style;record().request_id=null;record().request=null;await save();draw();status('Selected '+selected().title+'. Your reference stays the same.');}
 };
 $('closeStyleProfile').onclick=()=>$('styleProfileDialog').close();
 $('styleProfileFiles').onchange=async e=>{
  const files=[...e.target.files];if(!files.length)return;$('saveStyleProfile').disabled=true;$('styleProfileStatus').textContent='Reading profile…';
  try{const parsed=await parseProfileFiles(files);$('styleProfileName').value=parsed.title;$('styleProfileText').value=parsed.instructions;draftDescription=parsed.description;draftAnchors=[];for(const image of parsed.images)draftAnchors.push((await prepareImage(image,768)).data);$('styleProfileStatus').textContent=`Loaded ${parsed.fileCount} text file(s)${draftAnchors.length?' and '+draftAnchors.length+' style image(s)':''}. Review the name and save.`;}
  catch(e){$('styleProfileStatus').textContent=e.message;}finally{$('saveStyleProfile').disabled=false;}
 };
 $('styleProfileImages').onchange=async e=>{
  $('saveStyleProfile').disabled=true;try{const files=[...e.target.files];if(files.length>2)throw Error('Choose at most two style reference images.');const next=[];for(const file of files)next.push((await prepareImage(file,768)).data);draftAnchors=next;$('styleProfileStatus').textContent=`${next.length} visual style reference(s) ready.`;}
  catch(e){$('styleProfileStatus').textContent=e.message;}finally{$('saveStyleProfile').disabled=false;}
 };
 $('saveStyleProfile').onclick=async()=>{
  const previous=state.replikatorProfiles||[],previousSelection=state.replikatorStyle;
  try{const profile={id:'style_'+uuid(),title:$('styleProfileName').value.trim(),instructions:$('styleProfileText').value.trim(),description:draftDescription||'Imported context profile',anchors:draftAnchors};state.replikatorProfiles=validateProfiles([...previous,profile]);state.replikatorStyle=profile.id;record().request_id=null;record().request=null;await save();$('styleProfileDialog').close();draw();status('Saved '+profile.title+'. Upload a reference and click Replikate.');}
  catch(e){state.replikatorProfiles=previous;state.replikatorStyle=previousSelection;$('styleProfileStatus').textContent=e.message;}
 };
 $('replikatorFile').onchange=async e=>{
  const file=e.target.files[0];e.target.value='';if(!file)return;working=true;draw();try{const image=await prepareImage(file);state.replikator={source:image.data,dimensions:{width:image.width,height:image.height},name:file.name};await save();status('Reference ready. Click Replikate to apply '+selected().title+'.');}
  catch(e){status(e.message||'Could not save the reference.');}finally{working=false;draw();}
 };
 async function upload(data){const response=await livepeerRequest('upload',{data});if(!response.data?.url)throw Error('The upload did not return an image URL.');return response.data.url;}
 $('resetReplikator').onclick=async()=>{
  if(working)return;
  if(!window.confirm('Release this request so you can change the reference or style? This does not cancel a render at Livepeer. If it is still running, it may finish and use credits. No new render will start until you click Replikate.'))return;
  const r=record(),previous={...r},history=state.replikatorRequestHistory||[];
  state.replikatorRequestHistory=[...history,{job_id:r.job_id,request_id:r.request_id,request:r.request,releasedAt:new Date().toISOString()}].slice(-20);
  r.job_id=null;r.request_id=null;r.request=null;r.source_url=null;
  try{await save();status('Request released. You can now replace the reference or choose a style. Click Replikate when ready.');}
  catch{state.replikator=previous;state.replikatorRequestHistory=history;status('Could not save the reset. Please try again.');}
  draw();
 };
 $('replikateBtn').onclick=async()=>{
  if(working)return;if(record().job_id){await poll();return;}working=true;draw();try{
   const r=record(),style=selected();if(!r.source)throw Error('Upload a reference first.');
   if(!r.request){status('Uploading your reference and style anchors…');r.source_url||=await upload(r.source);
    state.replikatorAnchorCache||={};const cacheKey=style.id+':'+(style.revision||1);let anchor_urls=state.replikatorAnchorCache[cacheKey];
    if(!anchor_urls){anchor_urls=[];for(const anchor of style.anchors||[])anchor_urls.push(await upload(anchor));state.replikatorAnchorCache[cacheKey]=anchor_urls;}
    r.request_id=uuid();r.pendingStyle=style.title;
    r.request={profile:style.id,...(style.id!=='gta-vi'?{custom_profile:{...style,anchors:[]}}:{}),source_url:r.source_url,dimensions:r.dimensions,anchor_urls,request_id:r.request_id,confirm:true};await save();
   }
   status('Applying '+r.pendingStyle+' with the image editor…');const reply=await livepeerRequest('replikate',r.request);if(await finish(reply.data||{}))return;
   const job=reply.data?.job_id;if(!/^mjob_[a-z0-9]{6,32}$/.test(job||''))throw Error(reply.data?.human_summary||'Livepeer did not return an image job. Retry to check this request.');r.job_id=job;await save();await poll();
  }catch(e){await failure(e);}finally{working=false;draw();}
 };
 draw();
}
