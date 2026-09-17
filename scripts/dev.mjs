import http from 'node:http';
import fs from 'node:fs';
import worker from '../dist/server/index.js';
const option=(name,fallback)=>{const i=process.argv.indexOf(name);return i<0?fallback:process.argv[i+1]};
const port=Number(option('--port','3000')),host=option('--host','127.0.0.1');
http.createServer(async(req,res)=>{try{
 const pathname=new URL(req.url,'http://localhost').pathname;
 const asset=pathname==='/'?'index.html':pathname.slice(1);
 if(req.method==='GET'&&/^[a-zA-Z0-9.-]+$/.test(asset)&&fs.existsSync('public/'+asset)){res.writeHead(200,{'Content-Type':asset.endsWith('.js')?'text/javascript':asset.endsWith('.css')?'text/css':'text/html','Cache-Control':'no-store'});res.end(fs.readFileSync('public/'+asset));return}
 const parts=[];for await(const part of req)parts.push(part);
 const request=new Request('http://'+req.headers.host+req.url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(parts)}:{})});
 const result=await worker.fetch(request,{DAYDREAM_API_KEY:process.env.DAYDREAM_API_KEY,PYMTHOUSE_CLIENT_ID:process.env.PYMTHOUSE_CLIENT_ID});
 res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));
}catch{res.writeHead(500);res.end('Request failed.')}}).listen(port,host,()=>console.log('Worklow development server ready'));
