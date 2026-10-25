// Local workstation runtime. Hosted deployments continue to use the original
// Cloudflare/Neon entrypoints. This adapter runs the SAME catalogue routes and
// SQL repository against embedded PostgreSQL, with local files replacing R2.
import {createServer} from 'node:http';
import {readFile, mkdir, writeFile, rm} from 'node:fs/promises';
import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {AsyncLocalStorage} from 'node:async_hooks';
import vm from 'node:vm';
import {PGlite} from '@electric-sql/pglite';
import ts from 'typescript';
import {z} from 'zod';
import {initializeCatalogue} from '../customer-and-backend/scripts/catalogue-schema.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const backend=path.join(root,'customer-and-backend');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.ico':'image/x-icon','.ttf':'font/ttf','.woff2':'font/woff2','.woff':'font/woff','.mp4':'video/mp4','.webm':'video/webm','.txt':'text/plain; charset=utf-8'};
const localUser={userId:'lyca-local-owner',email:'owner@lyca.local',displayName:'Local administrator',fullName:'Local administrator'};

function adapter(db){
  return {
    query(text,params=[]){return {spec:{text,params},then(resolve,reject){return db.query(text,params).then(r=>r.rows).then(resolve,reject);}};},
    async transaction(queries){return db.transaction(async tx=>{
      const results=[];
      for(const {spec} of queries)results.push((await tx.query(spec.text,spec.params)).rows);
      return results;
    });},
  };
}

export async function startWorkspace(options={}){
  const dataDir=path.resolve(options.dataDir||path.join(root,'.local-data'));
  await mkdir(dataDir,{recursive:true});
  const lock=path.join(dataDir,'workspace.lock');
  for(let attempt=0;attempt<2;attempt++){
    try{await writeFile(lock,JSON.stringify({pid:process.pid}),{flag:'wx'});break;}
    catch(error){
      if(error.code!=='EEXIST')throw error;
      const previous=JSON.parse(await readFile(lock,'utf8'));
      let alive=true;
      try{process.kill(previous.pid,0);}catch(error){if(error.code==='ESRCH')alive=false;else throw error;}
      if(alive||attempt)throw new Error('This local workspace is already running. Close its terminal before starting it again.');
      await rm(lock);
    }
  }
  try{
    const workspace=await createWorkspace({...options,dataDir});
    let closed=false;
    return {...workspace,async close(){
      if(closed)return;closed=true;
      try{await workspace.close();}finally{await rm(lock,{force:true});}
    }};
  }catch(error){await rm(lock,{force:true});throw error;}
}

async function createWorkspace({dataDir,adminPort=5173,customerPort=5174,quiet=false}={}){
  if(!vm.SourceTextModule)throw new Error('Start with: node --experimental-vm-modules server.mjs');
  for(const entry of [path.join(here,'public/admin/index.html'),path.join(backend,'public/customer/index.html')]){
    if(!existsSync(entry))throw new Error('Built website files are missing. Use the complete ZIP or rebuild the customer and local admin assets.');
  }
  await mkdir(path.join(dataDir,'uploads'),{recursive:true});
  const db=new PGlite(path.join(dataDir,'postgres'));
  await db.waitReady;
  const sql=adapter(db);
  await initializeCatalogue(sql);

  const session=randomBytes(32).toString('hex');
  const identity=new AsyncLocalStorage();
  const environment={
    DATABASE_URL:'postgresql://local:local@localhost/lyca',
    CATALOGUE_DATABASE:'postgresql', CATALOGUE_READ_ONLY:'false',
    ADMIN_EMAIL:localUser.email,
    BUCKET:{
      async put(key,bytes,metadata){
        if(!/^[a-f0-9-]+\.(webp|png|jpg)$/.test(key))throw new Error('Invalid upload key');
        await writeFile(path.join(dataDir,'uploads',key),bytes);
        await writeFile(path.join(dataDir,'uploads',key+'.json'),JSON.stringify(metadata));
      },
      async get(key){
        if(!/^[a-f0-9-]+\.(webp|png|jpg)$/.test(key))return null;
        try{return {body:await readFile(path.join(dataDir,'uploads',key)),httpMetadata:JSON.parse(await readFile(path.join(dataDir,'uploads',key+'.json'),'utf8')).httpMetadata};}
        catch(error){if(error.code==='ENOENT')return null;throw error;}
      },
    },
  };
  const context=vm.createContext({console,Request,Response,File,FormData,URL,Uint8Array,TextEncoder,TextDecoder,crypto:globalThis.crypto,AbortSignal,setTimeout,clearTimeout});
  const cache=new Map();
  function synthetic(id,values){
    const m=new vm.SyntheticModule(Object.keys(values),function(){for(const [k,v]of Object.entries(values))this.setExport(k,v);},{context,identifier:id});
    cache.set(id,m);return m;
  }
  async function load(id){
    if(cache.has(id))return cache.get(id);
    if(id==='zod')return synthetic(id,{z});
    if(id==='@neondatabase/serverless')return synthetic(id,{neon:()=>sql});
    if(id==='cloudflare:workers')return synthetic(id,{env:environment});
    if(id===path.join(backend,'app/chatgpt-auth.ts'))return synthetic(id,{getChatGPTUser:async()=>identity.getStore()||null});
    if(id.endsWith('.json'))return synthetic(id,{default:JSON.parse(readFileSync(id,'utf8'))});
    if(!id.startsWith(backend+path.sep))throw new Error('Unsupported local import: '+id);
    const code=ts.transpileModule(readFileSync(id,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
    const m=new vm.SourceTextModule(code,{context,identifier:id});cache.set(id,m);
    await m.link((specifier,referencing)=>{
      let file=specifier.startsWith('@/')?path.join(backend,specifier.slice(2)):specifier.startsWith('.')?path.resolve(path.dirname(referencing.identifier),specifier):specifier;
      if(file.startsWith(backend+path.sep)&&!path.extname(file))file+='.ts';
      return load(file);
    });
    return m;
  }
  // Evaluate shared dependencies before independently linking route entrypoints.
  for(const file of ['db/postgres.ts','db/repository.ts','lib/store.ts','lib/ingredients.ts']){
    const m=await load(path.join(backend,file));if(m.status!=='evaluated')await m.evaluate();
  }
  const routes=new Map();
  for(const name of ['admin','ingredients','products','categories','settings','upload','catalogue','media/[key]']){
    const m=await load(path.join(backend,'app/api',name,'route.ts'));
    await m.evaluate();routes.set(name,m.namespace);
  }

  async function staticResponse(base,relative){
    const file=path.resolve(base,relative);
    if(!file.startsWith(path.resolve(base)+path.sep))return new Response('Not found',{status:404});
    try{return new Response(await readFile(file),{headers:{'Content-Type':mime[path.extname(file).toLowerCase()]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':path.extname(file)==='.html'?'no-store':'public, max-age=3600'}});}
    catch(error){if(['ENOENT','EISDIR','ENOTDIR'].includes(error.code))return new Response('Not found',{status:404});throw error;}
  }

  let customerOrigin;
  const servers=[];
  async function handle(incoming,outgoing,isAdminSite){
    try{
      const address=incoming.socket.localPort;
      // Loopback binding plus authority validation prevents DNS rebinding.
      if(![`localhost:${address}`,`127.0.0.1:${address}`].includes(incoming.headers.host)){
        outgoing.writeHead(403);outgoing.end('Use localhost or 127.0.0.1.');return;
      }
      const origin='http://'+incoming.headers.host;
      const url=new URL(incoming.url,origin);
      const cookies=(incoming.headers.cookie||'').split(';').map(v=>v.trim());
      const signedIn=cookies.includes('lyca_local_session='+session);
      const method=incoming.method||'GET';
      let response;
      if(url.pathname==='/signin-with-chatgpt'){
        response=new Response('<!doctype html><html><head><meta name="viewport" content="width=device-width"><title>LYCA Local Sign In</title></head><body style="font:18px system-ui;max-width:540px;margin:12vh auto;padding:24px"><h1>LYCA local workspace</h1><p>This workspace stores changes on this computer. It is separate from the live website.</p><form method="post" action="/local-signin"><button style="font:inherit;padding:14px 22px;cursor:pointer">Open local administrator</button></form><p><a href="/">Back</a></p></body></html>',{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'"}});
      }else if(url.pathname==='/local-signin'){
        if(!isAdminSite||method!=='POST'||incoming.headers.origin!==origin||incoming.headers['sec-fetch-site']==='cross-site')response=new Response('Forbidden',{status:403});
        else response=new Response(null,{status:303,headers:{Location:'/', 'Set-Cookie':`lyca_local_session=${session}; HttpOnly; SameSite=Strict; Path=/`, 'Cache-Control':'no-store'}});
      }else if(url.pathname==='/signout-with-chatgpt'){
        response=new Response(null,{status:303,headers:{Location:'/', 'Set-Cookie':'lyca_local_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0','Cache-Control':'no-store'}});
      }else if(isAdminSite&&url.pathname.startsWith('/customer')){
        response=new Response(null,{status:307,headers:{Location:customerOrigin+'/'+url.pathname.replace(/^\/customer\/?/,'')+url.search}});
      }else if(url.pathname.startsWith('/api/')){
        // A session is accepted only on the admin listener. Customer routes
        // remain public read-only even though browsers share cookies by host.
        const activeUser=isAdminSite&&signedIn?localUser:null;
        const media=/^\/api\/media\/([a-f0-9-]+\.(?:webp|png|jpg))$/.exec(url.pathname);
        const route=routes.get(media?'media/[key]':url.pathname.slice(5));
        if(!route)response=new Response('Not found',{status:404});
        else if(!['GET','HEAD'].includes(method)&&(!activeUser||incoming.headers.origin!==origin))response=Response.json({error:'Administrator access required.'},{status:403});
        else if(!route[method==='HEAD'?'GET':method])response=new Response('Method not allowed',{status:405});
        else{
          let total=0;const chunks=[];
          for await(const chunk of incoming){total+=chunk.length;if(total>6*1024*1024){const e=new Error('Upload too large');e.status=413;throw e;}chunks.push(chunk);}
          const headers=new Headers();
          for(const [key,value]of Object.entries(incoming.headers))if(value!==undefined&&!['x-lyca-admin-key','oai-authenticated-user-id','oai-authenticated-user-email'].includes(key))headers.set(key,Array.isArray(value)?value.join(', '):value);
          const req=new Request(url,{method:method==='HEAD'?'GET':method,headers,...(!['GET','HEAD'].includes(method)?{body:Buffer.concat(chunks)}:{})});
          response=await identity.run(activeUser,()=>route[method==='HEAD'?'GET':method](req,media?{params:Promise.resolve({key:media[1]})}:undefined));
        }
      }else if(!['GET','HEAD'].includes(method))response=new Response('Method not allowed',{status:405});
      else{
        let pathname;
        try{pathname=decodeURIComponent(url.pathname);}catch{pathname='\0';}
        if(pathname.includes('\0')||pathname.includes('\\'))response=new Response('Bad request',{status:400});
        else if(isAdminSite&&pathname.startsWith('/admin-assets/'))response=await staticResponse(path.join(here,'public/admin'),pathname.slice('/admin-assets/'.length));
        else if(pathname.startsWith('/images/'))response=await staticResponse(path.join(backend,'public'),pathname.slice(1));
        else if(!isAdminSite&&pathname.startsWith('/customer/'))response=await staticResponse(path.join(backend,'public'),pathname.slice(1));
        else if(path.extname(pathname))response=await staticResponse(path.join(backend,'public'),pathname.slice(1));
        else response=await staticResponse(isAdminSite?path.join(here,'public/admin'):path.join(backend,'public/customer'),'index.html');
      }
      const headers=Object.fromEntries(response.headers);
      headers['X-Content-Type-Options']='nosniff';
      headers['X-Frame-Options']='DENY';
      headers['Referrer-Policy']='same-origin';
      outgoing.writeHead(response.status,headers);
      outgoing.end(method==='HEAD'?undefined:Buffer.from(await response.arrayBuffer()));
    }catch(error){
      console.error('Local request failed:',error.message);
      if(!outgoing.headersSent)outgoing.writeHead(error.status||500,{'Content-Type':'application/json'});
      outgoing.end(JSON.stringify({error:error.status===413?'Image is too large.':'Local service error. Check the terminal.'}));
    }
  }
  async function listen(port,admin){
    const server=createServer((req,res)=>handle(req,res,admin));
    servers.push(server);
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
    return server.address().port;
  }
  let actualCustomer,actualAdmin;
  try{
    actualCustomer=await listen(customerPort,false);
    customerOrigin='http://localhost:'+actualCustomer;
    actualAdmin=await listen(adminPort,true);
  }catch(error){await Promise.all(servers.map(s=>new Promise(r=>s.close(r))));await db.close();throw error;}
  if(!quiet){
    console.log('\nLYCA LOCAL WORKSPACE\n');
    console.log(`Admin:    http://localhost:${actualAdmin}`);
    console.log(`Customer: ${customerOrigin}`);
    console.log(`Data:     ${dataDir}`);
    console.log('\nClick Sign in in the admin page, then Open local administrator.');
    console.log('Changes and uploaded images are saved on this computer.');
    console.log('This local workspace does not change the live website.');
    console.log('Keep this window open. Press Ctrl+C to stop.\n');
  }
  return {
    adminOrigin:'http://localhost:'+actualAdmin,customerOrigin,
    async close(){await Promise.all(servers.map(s=>new Promise(r=>{s.close(r);s.closeIdleConnections();})));await db.close();},
  };
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  let workspace;
  try{workspace=await startWorkspace();}
  catch(error){console.error('\nCannot start LYCA:',error.code==='EADDRINUSE'?'Port 5173 or 5174 is already in use. Close the other LYCA terminal and try again.':error.message);process.exitCode=1;}
  if(workspace){let stopping=false;for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{if(stopping)return;stopping=true;await workspace.close();process.exit(0);});}
}
