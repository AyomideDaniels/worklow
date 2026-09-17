export function extractPromptResult(value,targets,needsImage){
 const found=[];const visited=new Set();function walk(v){if(v===null||v===undefined)return;if(typeof v==='object'){if(visited.has(v))return;visited.add(v);if(typeof v.scene==='string'&&v.prompts&&typeof v.prompts==='object')found.push(v);for(const x of Object.values(v))walk(x)}else if(typeof v==='string'){const s=v.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'');try{walk(JSON.parse(s))}catch{const start=s.indexOf('{'),end=s.lastIndexOf('}');if(start>=0&&end>start)try{walk(JSON.parse(s.slice(start,end+1)))}catch{}}}}
 walk(value);const result=found.find(r=>r.scene.trim()&&targets.every(t=>typeof r.prompts[t]==='string'&&r.prompts[t].trim()));
 if(!result)throw Error('Livepeer did not return a complete scene and prompt result. Existing work was kept.');
 if(needsImage&&result.reference_analyzed!==true)throw Error('Livepeer did not confirm reference-image analysis. Existing work was kept.');
 return {scene:result.scene.slice(0,15000),prompts:Object.fromEntries(targets.map(t=>[t,result.prompts[t].slice(0,20000)])),reference_analyzed:result.reference_analyzed===true,limitations:Array.isArray(result.limitations)?result.limitations.map(String).slice(0,10):[],models_used:Array.isArray(result.models_used)?result.models_used.map(String).slice(0,10):[]};
}
