const textExtensions=/\.(md|markdown|txt|json)$/i;
const imageExtensions=/\.(png|jpe?g|webp)$/i;
export async function unpackSkill(file){
 if(file.size>12*1024*1024)throw Error('Skill packages must be under 12 MB.');
 const bytes=new Uint8Array(await file.arrayBuffer()),v=new DataView(bytes.buffer);let end=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(v.getUint32(i,true)===0x06054b50){end=i;break;}
 if(end<0)throw Error('This is not a supported ZIP skill package.');
 const count=v.getUint16(end+10,true);let pos=v.getUint32(end+16,true),total=0;const files=[];
 if(count>100)throw Error('Skill package contains too many files (maximum 100).');
 for(let n=0;n<count;n++){
  if(pos+46>bytes.length||v.getUint32(pos,true)!==0x02014b50)throw Error('Invalid skill archive.');
  const flags=v.getUint16(pos+8,true),method=v.getUint16(pos+10,true),compressed=v.getUint32(pos+20,true),size=v.getUint32(pos+24,true),nameLen=v.getUint16(pos+28,true),extra=v.getUint16(pos+30,true),comment=v.getUint16(pos+32,true),offset=v.getUint32(pos+42,true);
  const name=new TextDecoder().decode(bytes.slice(pos+46,pos+46+nameLen));pos+=46+nameLen+extra+comment;
  if(!textExtensions.test(name)&&!imageExtensions.test(name))continue;
  if(name.startsWith('__MACOSX/')||name.split('/').some(x=>x==='..'))continue;
  if(flags&1||![0,8].includes(method))throw Error('Encrypted or unsupported ZIP compression. Use a regular ZIP or SKILL.md file.');
  total+=size;if(size>6*1024*1024||total>20*1024*1024)throw Error('Expanded skill package is too large.');
  if(offset+30>bytes.length||v.getUint32(offset,true)!==0x04034b50)throw Error('Invalid skill archive entry.');
  const start=offset+30+v.getUint16(offset+26,true)+v.getUint16(offset+28,true);if(start+compressed>bytes.length)throw Error('Incomplete skill archive.');
  let data=bytes.slice(start,start+compressed);
  if(method===8){const reader=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();const chunks=[];let length=0;while(true){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>size||length>6*1024*1024){await reader.cancel();throw Error('Skill archive exceeds declared size.');}chunks.push(value);}data=new Uint8Array(await new Blob(chunks).arrayBuffer());}
  if(data.length!==size)throw Error('Skill archive contains an incomplete file.');
  files.push(new File([data],name,{type:/\.png$/i.test(name)?'image/png':/\.webp$/i.test(name)?'image/webp':/\.jpe?g$/i.test(name)?'image/jpeg':'text/plain'}));
 }
 return files;
}
export async function parseProfileFiles(input){
 let files=[];for(const file of input){if(/\.(zip|skill)$/i.test(file.name))files.push(...await unpackSkill(file));else files.push(file);}
 const documents=files.filter(f=>textExtensions.test(f.name)).sort((a,b)=>Number(!/skill\.md$/i.test(a.name))-Number(!/skill\.md$/i.test(b.name)));
 if(!documents.length)throw Error('Choose a JSON context profile, SKILL.md, text profile or ZIP skill package.');
 let title='',description='',parts=[];
 for(const file of documents){if(file.size>180000)throw Error('Profile text file is too large.');const text=(await file.text()).trim();if(!text)continue;
  if(/\.json$/i.test(file.name)){let json;try{json=JSON.parse(text)}catch{throw Error(file.name+' is not valid JSON.');}if(!title)title=typeof json.name==='string'?json.name:typeof json.title==='string'?json.title:'';if(!description&&typeof json.description==='string')description=json.description;}
  else if(!title){title=text.match(/^name:\s*["']?(.+?)["']?\s*$/m)?.[1]||text.match(/^#\s+(.+)$/m)?.[1]||'';description=text.match(/^description:\s*(.+)$/m)?.[1]||'';}
  parts.push('FILE: '+file.name+'\n'+text);
 }
 const instructions=parts.join('\n\n');if(instructions.length<20||instructions.length>48000)throw Error('Combined profile text must be 20–48,000 characters.');
 return {title:(title||documents[0].name.replace(/\.[^.]+$/,'').replace(/[-_]/g,' ')).slice(0,80),description:description.slice(0,180),instructions,images:files.filter(f=>imageExtensions.test(f.name)).slice(0,2),fileCount:documents.length};
}
export async function prepareImage(file,maxEdge=1600){
 if(!/image\/(png|jpeg|webp)/.test(file.type)||file.size>25*1024*1024)throw Error('Choose a PNG, JPG or WebP under 25 MB.');
 const src=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('Could not read image.'));r.readAsDataURL(file);});
 const im=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Could not decode image.'));img.src=src;});
 const scale=Math.min(1,maxEdge/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(im.width*scale));c.height=Math.max(1,Math.round(im.height*scale));const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(im,0,0,c.width,c.height);const data=c.toDataURL('image/jpeg',.92);if(data.length>2800000)throw Error('Image is too large to send. Please use a smaller file.');return {data,width:c.width,height:c.height};
}
