import {spawnSync,spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const runtime=path.join(root,'local-runtime');
const [major,minor]=process.versions.node.split('.').map(Number);
if(major<22||(major===22&&minor<13)){
  console.error('LYCA needs Node.js 22.13 or newer. Your version is '+process.version+'.');
  process.exit(1);
}
const require=createRequire(path.join(runtime,'package.json'));
let installed=true;
for(const [name,version]of [['@electric-sql/pglite','0.5.10'],['typescript','5.9.3'],['zod','3.25.76']]){
  try{
    require.resolve(name);
    if(JSON.parse(readFileSync(path.join(runtime,'node_modules',name,'package.json'),'utf8')).version!==version)installed=false;
  }
  catch{installed=false;}
}
if(!installed){
  console.log('Restoring the local runtime. Internet is needed for this repair only.');
  const result=process.platform==='win32'
    ?spawnSync('cmd.exe',['/d','/s','/c','npm ci --ignore-scripts --include=optional --no-audit --no-fund'],{cwd:runtime,stdio:'inherit'})
    :spawnSync('npm',['ci','--ignore-scripts','--include=optional','--no-audit','--no-fund'],{cwd:runtime,stdio:'inherit'});
  if(result.error||result.status!==0){console.error('Runtime repair failed. Check the message above.');process.exit(1);}
}
// Always use this exact Node executable and argument arrays: paths with spaces
// are supported without a shell, and VM Modules is enabled on Node 22 and 24.
const child=spawn(process.execPath,['--experimental-vm-modules',path.join(runtime,'server.mjs')],{cwd:root,stdio:'inherit'});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('error',error=>{console.error(error.message);process.exitCode=1;});
const status=await new Promise(resolve=>child.once('close',resolve));
process.exitCode=status??1;
