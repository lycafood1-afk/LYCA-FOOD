import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {startWorkspace} from './server.mjs';
import {PGlite} from '@electric-sql/pglite';

const dataDir=await mkdtemp(path.join(tmpdir(),'lyca-workspace-test-'));
let workspace;
try{
  const setup=new PGlite();await setup.waitReady;
  try{
    const sql=await readFile(new URL('../POSTGRESQL-SETUP.sql',import.meta.url),'utf8');
    await setup.exec(sql);await setup.exec(sql);
    assert.equal((await setup.query('SELECT count(*)::int AS n FROM lyca.ingredients')).rows[0].n,0);
    assert.equal((await setup.query('SELECT count(*)::int AS n FROM lyca.categories')).rows[0].n,7);
    await setup.query("DELETE FROM lyca.categories WHERE id='food-colours'");
    await setup.exec(sql);
    assert.equal((await setup.query('SELECT count(*)::int AS n FROM lyca.categories')).rows[0].n,6);
    await setup.query("INSERT INTO lyca.ingredients (id,data) VALUES ('preserved-setup-record','{}'::jsonb)");
    await setup.exec(sql);
    assert.equal((await setup.query('SELECT count(*)::int AS n FROM lyca.ingredients')).rows[0].n,1);
  }finally{await setup.close();}
  workspace=await startWorkspace({dataDir,adminPort:0,customerPort:0,quiet:true});
  await assert.rejects(()=>startWorkspace({dataDir,adminPort:0,customerPort:0,quiet:true}),/already running/);
  let admin=workspace.adminOrigin,customer=workspace.customerOrigin;
  const login=async()=>{
    const r=await fetch(admin+'/local-signin',{method:'POST',headers:{Origin:admin},redirect:'manual'});
    assert.equal(r.status,303);return r.headers.get('set-cookie').split(';')[0];
  };
  let cookie=await login();
  const get=async(url,authenticated=true)=>{
    const r=await fetch(url,{headers:authenticated?{Cookie:cookie}:{}});assert.equal(r.status,200);return r.json();
  };
  const save=(ingredient,expectedVersion,create=false,extra={})=>fetch(admin+'/api/ingredients',{
    method:'POST',headers:{Origin:admin,Cookie:cookie,'Content-Type':'application/json',...extra},
    body:JSON.stringify({ingredient,expectedVersion,create}),
  });
  assert.equal((await get(admin+'/api/admin',false)).admin,false);
  assert.equal((await get(admin+'/api/admin')).admin,true);
  assert.equal((await fetch(admin+'/api/ingredients?admin=1')).status,403);
  assert.equal((await fetch(admin+'/api/ingredients?admin=1',{headers:{'x-lyca-admin-key':'fake','oai-authenticated-user-email':'owner@lyca.local'}})).status,403);
  assert.equal((await fetch(admin+'/local-signin',{method:'POST',headers:{Origin:'https://other.example'}})).status,403);
  assert.equal((await get(customer+'/api/admin')).admin,false);
  const initial=await get(customer+'/api/catalogue',false);
  assert.equal(initial.ingredients.length,0);assert.equal(initial.storage,'postgresql');
  assert.equal(initial.categories.length,7);
  assert.equal((await get(customer+'/api/products',false)).products.length,0);
  const category={id:'spices-and-herbs',title:'Spices & Herbs',shortTitle:'Spices & Herbs',description:'New ingredient family தமிழ்',image:'/images/fruit.webp',imageAlt:'Spices and herbs',imageCaption:'SPICES & HERBS',groups:['Whole spices']};
  const createCategory=(value,headers={Origin:admin,Cookie:cookie})=>fetch(admin+'/api/categories',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(value)});
  assert.equal((await createCategory(category,{Origin:admin})).status,403);
  assert.equal((await createCategory(category,{Origin:'https://other.example',Cookie:cookie})).status,403);
  assert.equal((await createCategory(category)).status,200);
  assert.equal((await createCategory({...category,id:'another-id',title:'spices & herbs'})).status,409);
  const withCategory=await get(customer+'/api/catalogue',false);
  assert.equal(withCategory.categories.length,8);assert.notEqual(withCategory.revision,initial.revision);
  assert(withCategory.categories.some(c=>c.id===category.id));
  const sample={id:'local-workspace-fixture',name:'Local workspace test ingredient',category:category.id,group:'Whole spices',description:'Persistent local test தமிழ்',status:'draft',image:'/images/fruit.webp',imageAlt:'Local test ingredient',specifications:'Test specifications',partner:''};
  let r=await save(sample,0,true);assert.equal(r.status,200);
  assert.equal((await get(customer+'/api/catalogue',false)).ingredients.length,0);
  assert.equal((await save(sample,1,false,{Origin:'https://other.example'})).status,403);
  assert.equal((await fetch(customer+'/api/ingredients',{method:'POST',headers:{Origin:customer,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({ingredient:sample,expectedVersion:1,create:false})})).status,403);
  const published={...sample,status:'published'};
  r=await save(published,1);assert.equal(r.status,200);
  assert.equal((await get(customer+'/api/catalogue',false)).ingredients.length,1);
  assert.equal((await save(published,1)).status,409);
  const race=await Promise.all([save({...published,description:'Concurrent one'},2),save({...published,description:'Concurrent two'},2)]);
  assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64');
  const form=new FormData();form.append('image',new File([png],'ingredient.png',{type:'image/png'}));
  r=await fetch(admin+'/api/upload',{method:'POST',headers:{Origin:admin,Cookie:cookie},body:form});assert.equal(r.status,200);
  const {url:photo}=await r.json();
  const changeCategory=(value,expectedVersion,headers={Origin:admin,Cookie:cookie})=>fetch(admin+'/api/categories',{method:'PATCH',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({category:value,expectedVersion})});
  const removeCategory=(id,expectedVersion,deleteIngredients=false,headers={Origin:admin,Cookie:cookie})=>fetch(admin+'/api/categories',{method:'DELETE',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({id,expectedVersion,deleteIngredients,confirmation:'DELETE CATEGORY'})});
  assert.equal((await changeCategory({...category,image:photo},1,{Origin:admin})).status,403);
  assert.equal((await changeCategory({...category,image:photo},1)).status,200);
  assert.equal((await changeCategory({...category,image:'/images/coconut.webp'},1)).status,409);
  const categoryPhoto=(await get(customer+'/api/catalogue',false)).categories.find(c=>c.id===category.id);
  assert.equal(categoryPhoto.image,photo);assert.equal(categoryPhoto.version,2);
  assert.equal((await createCategory({...category,id:'photo-category',title:'Photo category',shortTitle:'Photo category',image:photo})).status,200);
  assert.equal((await removeCategory('photo-category',1,false,{Origin:admin})).status,403);
  assert.equal((await removeCategory('photo-category',1,false,{Origin:'https://other.example',Cookie:cookie})).status,403);
  assert.equal((await removeCategory('photo-category',1)).status,200);
  const deletedDefault=initial.categories[0].id;
  assert.equal((await removeCategory(deletedDefault,1)).status,200);
  assert.equal((await save({...sample,id:'orphan-attempt',name:'Orphan attempt',category:deletedDefault},0,true)).status,400);

  r=await fetch(customer+photo);assert.equal(r.status,200);assert.deepEqual(Buffer.from(await r.arrayBuffer()),png);
  r=await save({...published,image:photo},3);assert.equal(r.status,200);
  const contact={serviceId:'test-local-service',templateId:'test-local-template',publicKey:'test-local-public',responsePromise:'Local test'};
  r=await fetch(admin+'/api/settings',{method:'POST',headers:{Origin:admin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(contact)});assert.equal(r.status,200);
  assert.deepEqual(await get(customer+'/api/settings',false),contact);
  for(const [origin,page]of [[admin,'/'],[customer,'/'],[customer,'/products'],[customer,'/enquiry']]){
    r=await fetch(origin+page);assert.equal(r.status,200);
    const html=await r.text();assert(html.includes('<html'));
    for(const match of html.matchAll(/(?:src|href)="([^"#]+\.(?:js|css|svg))"/g)){
      const assetUrl=new URL(match[1],origin);
      const asset=await fetch(assetUrl);assert.equal(asset.status,200,match[1]);
      assert(!asset.headers.get('content-type').includes('text/html'),match[1]);
      if(assetUrl.pathname.endsWith('.css')){
        const css=await asset.text();
        for(const entry of css.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^"'()\s]+))\s*\)/g)){
          const reference=entry[1]??entry[2]??entry[3];
          if(reference.startsWith('data:')||reference.startsWith('#'))continue;
          const nestedUrl=new URL(reference,assetUrl);
          const nested=await fetch(nestedUrl);assert.equal(nested.status,200,nestedUrl.href);
          assert(!nested.headers.get('content-type').includes('text/html'),nestedUrl.href);
        }
      }
    }
  }
  for(const name of ['manrope0.ttf','manrope1.ttf','manrope2.ttf','manrope3.ttf','manrope4.ttf','editorial-italic.ttf']){
    r=await fetch(customer+'/customer/fonts/'+name);assert.equal(r.status,200,name);
    assert.equal(r.headers.get('content-type'),'font/ttf');assert((await r.arrayBuffer()).byteLength>1000,name);
  }
  r=await fetch(customer+'/customer/favicon.svg');assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'image/svg+xml');
  r=await fetch(admin+'/customer/',{redirect:'manual'});assert.equal(r.status,307);assert.equal(r.headers.get('location'),customer+'/');
  r=await fetch(admin+'/api/media/invalid.png');assert.equal(r.status,404);
  // Restart with the same data directory: edits and image files must survive,
  // and a previous session must no longer authenticate.
  await workspace.close();
  workspace=await startWorkspace({dataDir,adminPort:0,customerPort:0,quiet:true});
  admin=workspace.adminOrigin;customer=workspace.customerOrigin;
  assert.equal((await get(admin+'/api/admin')).admin,false);
  cookie=await login();
  const persisted=(await get(admin+'/api/ingredients?admin=1')).ingredients.find(p=>p.id===sample.id);
  assert.equal(persisted.version,4);assert.equal(persisted.image,photo);
  const savedCategories=(await get(customer+'/api/catalogue',false)).categories;
  assert.equal(savedCategories.find(c=>c.id===category.id).image,photo);
  assert(!savedCategories.some(c=>c.id===deletedDefault||c.id==='photo-category'));
  assert.deepEqual(await get(customer+'/api/settings',false),contact);
  r=await fetch(customer+photo);assert.deepEqual(Buffer.from(await r.arrayBuffer()),png);
  assert.equal((await save({...persisted,status:'archived'},4)).status,200);
  assert.equal((await get(customer+'/api/catalogue',false)).ingredients.length,0);
  const remove=(body,headers={Origin:admin,Cookie:cookie})=>fetch(admin+'/api/ingredients',{method:'DELETE',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await remove({id:sample.id,expectedVersion:5},{Origin:admin})).status,403);
  assert.equal((await remove({id:sample.id,expectedVersion:5},{Origin:'https://other.example',Cookie:cookie})).status,403);
  assert.equal((await remove({id:sample.id,expectedVersion:1})).status,409);
  assert.equal((await remove({id:sample.id,expectedVersion:5})).status,200);
  assert.equal((await get(admin+'/api/ingredients?admin=1')).ingredients.length,0);
  assert.equal((await save({...persisted,status:'published'},5)).status,404);
  assert.equal((await save({...sample,id:'bulk-one',name:'Bulk test one',status:'published'},0,true)).status,200);
  assert.equal((await save({...sample,id:'bulk-two',name:'Bulk test two',status:'draft'},0,true)).status,200);
  const legacy={id:'legacy-fixture',name:'Legacy test product',category:'coconut',description:'A legacy test product for bulk deletion.',image:'/images/coconut.webp',forms:'Powder',applications:['Beverages'],details:''};
  assert.equal((await fetch(admin+'/api/products',{method:'POST',headers:{Origin:admin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(legacy)})).status,200);
  assert.equal((await createCategory({...category,id:'coconut',title:'Separate Coconut Collection',shortTitle:'Separate Coconut Collection'})).status,200);
  assert.equal((await removeCategory('coconut',1)).status,200);
  assert.equal((await get(customer+'/api/products',false)).products.length,1);
  assert.equal((await remove({all:true,confirmation:'wrong'})).status,400);
  assert.equal((await remove({all:true,confirmation:'DELETE ALL PRODUCTS'})).status,200);
  assert.equal((await get(customer+'/api/catalogue',false)).ingredients.length,0);
  assert.equal((await get(customer+'/api/products',false)).products.length,0);
  await workspace.close();workspace=await startWorkspace({dataDir,adminPort:0,customerPort:0,quiet:true});
  admin=workspace.adminOrigin;customer=workspace.customerOrigin;cookie=await login();
  const empty=await get(customer+'/api/catalogue',false);
  assert.equal(empty.ingredients.length,0);assert.equal(empty.categories.length,7);
  assert.equal((await get(admin+'/api/ingredients?admin=1')).ingredients.length,0);
  assert.equal((await get(customer+'/api/products',false)).products.length,0);
  const cascade={...category,id:'cascade-category',title:'Cascade category',shortTitle:'Cascade category',image:photo};
  assert.equal((await createCategory(cascade)).status,200);
  assert.equal((await save({...sample,id:'cascade-one',name:'Cascade ingredient one',category:cascade.id,status:'published'},0,true)).status,200);
  assert.equal((await save({...sample,id:'cascade-two',name:'Cascade ingredient two',category:cascade.id,status:'draft'},0,true)).status,200);
  assert.equal((await removeCategory(cascade.id,1,false)).status,409);
  assert.equal((await removeCategory(cascade.id,99,true)).status,409);
  assert.equal((await get(admin+'/api/ingredients?admin=1')).ingredients.length,2);
  const removed=await removeCategory(cascade.id,1,true);assert.equal(removed.status,200);assert.equal((await removed.json()).deletedIngredients,2);
  assert.equal((await get(admin+'/api/ingredients?admin=1')).ingredients.length,0);
  for(const c of (await get(customer+'/api/catalogue',false)).categories)assert.equal((await removeCategory(c.id,c.version)).status,200);
  await workspace.close();workspace=await startWorkspace({dataDir,adminPort:0,customerPort:0,quiet:true});
  admin=workspace.adminOrigin;customer=workspace.customerOrigin;cookie=await login();
  assert.equal((await get(customer+'/api/catalogue',false)).categories.length,0);
  assert.equal((await createCategory({...category,id:'fresh-start',title:'Fresh start',shortTitle:'Fresh start',image:photo})).status,200);
  console.log(JSON.stringify({result:'PASS',repeatablePostgresSetupSql:true,initialIngredients:0,localSignIn:true,dynamicCategoriesPersisted:true,categoryPhotoUploadAndUpdate:true,categoryPhotoSurvivesRestart:true,categoryDeletionAndCascade:true,categoryDeletionVersionChecked:true,deletedDefaultsNeverReturn:true,zeroCategoriesSupported:true,categoryRevisionChanges:true,duplicateCategoriesBlocked:true,unauthorizedWritesBlocked:true,customerListenerReadOnly:true,draftPublishArchiveSync:true,staleAndConcurrentEditsProtected:true,permanentDeletion:true,staleDeletionBlocked:true,deletedProductsCannotBeEditedBack:true,bulkDeletesIngredientsAndLegacyProducts:true,deletionsSurviveRestart:true,imageUploadAndRead:true,settingsPersisted:true,restartPreservesEditsAndImages:true,oldSessionInvalidated:true,customerAndAdminAssets:true,customerCssAssetsAndFonts:true,customerFavicon:true,customerDeepLinks:true},null,2));
}finally{
  await workspace?.close();
  await rm(dataDir,{recursive:true,force:true});
}
