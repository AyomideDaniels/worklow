import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
for(const file of ['public/app.js','public/replikator.js','public/replikator-gallery.js','public/profile-import.js','public/style-profiles.js','server/replikator.js','public/livepeer.js','server/worker.js','server/prompts.js','server/direct-prompts.js','public/prompt-agent.js'])execFileSync(process.execPath,['--check',file]);
fs.rmSync('dist',{recursive:true,force:true});fs.mkdirSync('dist/server',{recursive:true});fs.mkdirSync('dist/.openai',{recursive:true});
const types={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',svg:'image/svg+xml'};
fs.writeFileSync('public/prompt-parser.js',fs.readFileSync('server/prompts.js','utf8').split('export function extractPromptResult')[1] ? 'export function extractPromptResult'+fs.readFileSync('server/prompts.js','utf8').split('export function extractPromptResult')[1] : '');
const assets={};for(const name of fs.readdirSync('public')){const ext=name.split('.').at(-1);if(!types[ext])throw Error('Unsupported asset '+name);assets['/'+name]={body:fs.readFileSync('public/'+name,'utf8'),type:types[ext]};}
fs.writeFileSync('dist/server/assets.js','export const assets='+JSON.stringify(assets)+';');
fs.copyFileSync('public/style-profiles.js','dist/server/style-profiles.js');fs.copyFileSync('server/replikator.js','dist/server/replikator.js');fs.copyFileSync('server/worker.js','dist/server/index.js');fs.copyFileSync('server/prompts.js','dist/server/prompts.js');fs.copyFileSync('server/direct-prompts.js','dist/server/direct-prompts.js');fs.copyFileSync('.openai/hosting.json','dist/.openai/hosting.json');
console.log('Built Worklow with server-side Livepeer Agent connection.');
