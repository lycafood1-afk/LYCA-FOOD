import {existsSync,readFileSync,mkdirSync,cpSync,rmSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const customer=path.join(root,'customer-site');
const npm=process.platform==='win32'?'npm.cmd':'npm';
const fingerprint=createHash('sha256').update(readFileSync(path.join(customer,'package.json'))).update(readFileSync(path.join(customer,'package-lock.json'))).digest('hex');
const marker=path.join(customer,'node_modules','.lyca-dependencies');
function run(args,env=process.env){const result=spawnSync(npm,args,{cwd:customer,env,stdio:'inherit',shell:process.platform==='win32'});if(result.error)throw result.error;if(result.status!==0)process.exit(result.status||1);}
if(!existsSync(marker)||readFileSync(marker,'utf8')!==fingerprint){run(['ci','--include=dev','--include=optional','--no-audit','--no-fund']);writeFileSync(marker,fingerprint);}
run(['run','build'],{...process.env,VITE_ASSET_BASE:'/customer/',VITE_ROUTER_BASENAME:'/',VITE_CATALOGUE_API_URL:'/api/catalogue'});
const target=path.join(root,'public','customer');
rmSync(target,{recursive:true,force:true});mkdirSync(target,{recursive:true});
// Vite rewrites public asset URLs to /customer/ too. Copy its complete output
// so fonts, the favicon and images exist under that prefix alongside JS/CSS.
for(const name of readdirSync(path.join(customer,'dist')))cpSync(path.join(customer,'dist',name),path.join(target,name),{recursive:true});
cpSync(path.join(customer,'public'),path.join(root,'public'),{recursive:true});
console.log('Uploaded LYCA customer design built with the shared catalogue connection.');
