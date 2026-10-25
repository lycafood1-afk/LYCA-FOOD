// Optional developer setup. The prebuilt local workspace does not need Vite,
// Rolldown, pnpm, Bash, or a native Windows addon to run.
import {spawnSync} from 'node:child_process';
import {rmSync,readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const args=process.argv.slice(2);
const index=args.indexOf('--project');
const selected=index<0?['customer-and-backend','admin-site']:[args[index+1]];
const [major,minor]=process.versions.node.split('.').map(Number);
if(major<22||(major===22&&minor<13))throw new Error('Install Node.js 22.13 or newer.');
for(const name of selected){
  if(!['admin-site','customer-and-backend'].includes(name))throw new Error('Unknown source project.');
  const cwd=path.join(root,name);
  if(args.includes('--repair')){
    console.log('Removing installed dependencies for '+name+'; source and lockfile are preserved.');
    rmSync(path.join(cwd,'node_modules'),{recursive:true,force:true});
  }
  const manifest=JSON.parse(readFileSync(path.join(cwd,'package.json'),'utf8'));
  if(manifest.packageManager!=='pnpm@11.25.0')throw new Error('Unexpected package manager version.');
  const install=['install','--frozen-lockfile','--prod=false','--ignore-scripts=false','--config.optional=true'];
  let result;
  // Reuse the image-pinned manager when available; Windows uses the same pin
  // through npx without requiring Corepack or a global pnpm installation.
  if(process.env.SITES_PNPM_BIN&&existsSync(process.env.SITES_PNPM_BIN)){
    result=spawnSync(process.execPath,[process.env.SITES_PNPM_BIN,...install],{cwd,stdio:'inherit',env:{...process.env,CI:'true'}});
  }else if(process.platform==='win32'){
    result=spawnSync('cmd.exe',['/d','/s','/c','npx --yes pnpm@11.25.0 '+install.join(' ')],{cwd,stdio:'inherit',env:{...process.env,CI:'true'}});
  }else{
    result=spawnSync('npx',['--yes','pnpm@11.25.0',...install],{cwd,stdio:'inherit',env:{...process.env,CI:'true'}});
  }
  if(result.error||result.status!==0){console.error('Dependency installation failed for '+name+'.');process.exit(result.status||1);}
  // Import Vite to force Rolldown's platform binding to load now, rather than
  // leaving a successful-looking install that fails when the user starts dev.
  result=spawnSync(process.execPath,['--input-type=module','-e',"await import('vite'); console.log('Vite and Rolldown native binding: OK');"],{cwd,stdio:'inherit'});
  if(result.error||result.status!==0){
    console.error('Native dependency check failed. Run SETUP-SOURCE-WINDOWS.cmd --repair or node scripts/setup-source.mjs --repair.');
    process.exit(result.status||1);
  }
}
console.log('Source dependencies are ready. See START-HERE.md for builds and hosting configuration.');
