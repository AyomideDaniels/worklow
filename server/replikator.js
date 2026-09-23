import {gtaStyle,legoStyle,makeStylePrompt,validateProfiles} from './style-profiles.js';
export const replikatorModel='gpt-image-edit';
export async function replikator(body,call){
 if(body.confirm!==true)throw Error('Click Replikate to use account credits.');
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(body.request_id||''))throw Error('Missing generation request ID.');
 const style=body.profile==='gta-vi'?gtaStyle:body.profile==='lego'?legoStyle:validateProfiles([body.custom_profile])[0];
 const source=new URL(body.source_url);if(source.protocol!=='https:')throw Error('Upload a valid reference first.');
 const anchors=body.anchor_urls||[];if(!Array.isArray(anchors)||anchors.length>2)throw Error('Use up to two style references.');
 for(const url of anchors){if(typeof url!=='string'||url.length>2000||new URL(url).protocol!=='https:')throw Error('Invalid style reference.');}
 const price=await call('get_pricing',{name:replikatorModel});const rows=price.data.capabilities||[];const row=rows.find(r=>r.name===replikatorModel);const rate=row?.display_price_usd;
 if(typeof rate!=='number'||rate<=0||rate>0.75||row.unit_kind!=='image')throw Error('Image pricing changed or is unavailable. Please check again before generating.');
 const dimensions=body.dimensions;let image_size='auto';
 if(dimensions&&Number.isInteger(dimensions.width)&&Number.isInteger(dimensions.height)&&dimensions.width>0&&dimensions.height>0&&dimensions.width<=1600&&dimensions.height<=1600){
  const {width,height}=dimensions;if(Math.max(width/height,height/width)>3)throw Error('This image editor supports aspect ratios up to 3:1. Choose a less panoramic reference.');
  const scale=Math.max(1,Math.sqrt(786432/(width*height)));image_size={width:Math.ceil(width*scale/16)*16,height:Math.ceil(height*scale/16)*16};
 }
 return call('run_capability',{capability:replikatorModel,source_url:source.href,prompt:makeStylePrompt(style,anchors.length),inputs:{image_urls:[source.href,...anchors],image_size,quality:'high',num_images:1,output_format:'png'},async:true,persist:true,timeout:310,idempotency_key:body.request_id},'raw');
}
