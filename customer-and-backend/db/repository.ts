import {databaseProvider,getPostgres,legacyDatabase} from './postgres';

export type StoredIngredient={id:string;data:Record<string,unknown>;status:'draft'|'published'|'archived';version:number;updatedAt:string};
export type StoredProduct={id:string;data:Record<string,unknown>;archived:boolean};
const object=(data:unknown):Record<string,unknown>=>typeof data==='string'?JSON.parse(data):data as Record<string,unknown>;
export async function ingredientRecords():Promise<StoredIngredient[]>{
  if(databaseProvider()==='d1'){
    const result=await legacyDatabase().prepare('SELECT id,data,status,version,updated_at FROM ingredients').all<{id:string;data:string;status:StoredIngredient['status'];version:number;updated_at:string}>();
    return result.results.map(row=>({id:row.id,data:object(row.data),status:row.status,version:row.version,updatedAt:row.updated_at}));
  }
  const rows=await getPostgres().query('SELECT id,data,status,version,updated_at FROM lyca.ingredients ORDER BY id');
  return rows.map(row=>({id:String(row.id),data:object(row.data),status:row.status as StoredIngredient['status'],version:Number(row.version),updatedAt:new Date(row.updated_at).toISOString()}));
}
export async function saveIngredientRecord(id:string,data:Record<string,unknown>,status:StoredIngredient['status'],expectedVersion:number,updatedAt:string,create=false):Promise<boolean>{
  if(databaseProvider()==='d1'){
    const db=legacyDatabase();
    const result=create
      ?await db.prepare('INSERT INTO ingredients (id,data,status,version,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(id,JSON.stringify(data),status,1,updatedAt).run()
      :await db.prepare('UPDATE ingredients SET data=?,status=?,version=?,updated_at=? WHERE id=? AND version=?').bind(JSON.stringify(data),status,expectedVersion+1,updatedAt,id,expectedVersion).run();
    return !!result.meta.changes;
  }
  const rows=create
    ?await getPostgres().query('WITH chosen AS (SELECT id FROM lyca.categories WHERE id=$5 FOR KEY SHARE) INSERT INTO lyca.ingredients (id,data,status,version,updated_at) SELECT $1,$2::jsonb,$3,1,$4::timestamptz FROM chosen ON CONFLICT(id) DO NOTHING RETURNING id',[id,JSON.stringify(data),status,updatedAt,data.category])
    :await getPostgres().query('WITH chosen AS (SELECT id FROM lyca.categories WHERE id=$7 FOR KEY SHARE) UPDATE lyca.ingredients SET data=$2::jsonb,status=$3,version=$4,updated_at=$5::timestamptz WHERE id=$1 AND version=$6 AND EXISTS(SELECT 1 FROM chosen) RETURNING id',[id,JSON.stringify(data),status,expectedVersion+1,updatedAt,expectedVersion,data.category]);
  return rows.length===1;
}
export async function deleteIngredientRecord(id:string,expectedVersion:number){
  if(databaseProvider()==='d1'){
    const result=await legacyDatabase().prepare('DELETE FROM ingredients WHERE id=? AND version=?').bind(id,expectedVersion).run();
    return !!result.meta.changes;
  }
  const rows=await getPostgres().query('DELETE FROM lyca.ingredients WHERE id=$1 AND version=$2 RETURNING id',[id,expectedVersion]);
  return rows.length===1;
}
export async function deleteAllProducts(){
  if(databaseProvider()==='d1'){
    await legacyDatabase().batch([legacyDatabase().prepare('DELETE FROM ingredients'),legacyDatabase().prepare('DELETE FROM products')]);
    return;
  }
  const sql=getPostgres();
  await sql.transaction([sql.query('DELETE FROM lyca.ingredients'),sql.query('DELETE FROM lyca.products')]);
}
export type StoredCategory={id:string;title:string;shortTitle:string;description:string;image:string;imageAlt:string;imageCaption:string;groups:string[];version:number};
export async function categoryRecords():Promise<StoredCategory[]>{
  if(databaseProvider()==='d1')throw new Error('Category management requires PostgreSQL.');
  const rows=await getPostgres().query('SELECT id,data,version FROM lyca.categories ORDER BY sort_order,id');
  return rows.map(row=>{
    const data=object(row.data);
    const groups=Array.isArray(data.groups)?data.groups.map(group=>typeof group==='string'?group:group&&typeof group==='object'&&'name' in group?String(group.name):'').filter(Boolean):[];
    return {...data,groups,id:String(row.id),version:Number(row.version)} as StoredCategory;
  });
}
export async function createCategory(category:Omit<StoredCategory,'version'>){
  const rows=await getPostgres().query('INSERT INTO lyca.categories (id,data,sort_order) VALUES ($1,$2::jsonb,(SELECT COALESCE(max(sort_order),0)+1 FROM lyca.categories)) ON CONFLICT DO NOTHING RETURNING id',[category.id,JSON.stringify(category)]);
  return rows.length===1;
}
export async function updateCategory(category:Omit<StoredCategory,'version'>,expectedVersion:number){
  const rows=await getPostgres().query('UPDATE lyca.categories SET data=$2::jsonb,version=version+1 WHERE id=$1 AND version=$3 RETURNING version',[category.id,JSON.stringify(category),expectedVersion]);
  return rows.length?Number(rows[0].version):null;
}
export async function deleteCategory(id:string,expectedVersion:number,deleteIngredients:boolean){
  const sql=getPostgres();
  const results=await sql.transaction([
    sql.query('SELECT id FROM lyca.categories WHERE id=$1 FOR UPDATE',[id]),
    sql.query("DELETE FROM lyca.ingredients WHERE data->>'category'=$1 AND $3::boolean AND EXISTS(SELECT 1 FROM lyca.categories WHERE id=$1 AND version=$2) RETURNING id",[id,expectedVersion,deleteIngredients]),
    sql.query("DELETE FROM lyca.categories WHERE id=$1 AND version=$2 AND NOT EXISTS(SELECT 1 FROM lyca.ingredients WHERE data->>'category'=$1) RETURNING id",[id,expectedVersion]),
  ]);
  return {deleted:results[2].length===1,deletedIngredients:results[1].length};
}
export async function productRecords():Promise<StoredProduct[]>{
  if(databaseProvider()==='d1'){
    const result=await legacyDatabase().prepare('SELECT id,data,archived FROM products').all<{id:string;data:string;archived:number}>();
    return result.results.map(row=>({id:row.id,data:object(row.data),archived:!!row.archived}));
  }
  const rows=await getPostgres().query('SELECT id,data,archived FROM lyca.products ORDER BY id');
  return rows.map(row=>({id:String(row.id),data:object(row.data),archived:!!row.archived}));
}
export async function saveProductRecord(id:string,data:Record<string,unknown>,archived:boolean){
  if(databaseProvider()==='d1'){await legacyDatabase().prepare('INSERT INTO products (id,data,archived) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,archived=excluded.archived').bind(id,JSON.stringify(data),archived?1:0).run();return;}
  await getPostgres().query('INSERT INTO lyca.products (id,data,archived) VALUES ($1,$2::jsonb,$3) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data,archived=EXCLUDED.archived',[id,JSON.stringify(data),archived]);
}
export async function publicSettings():Promise<Record<string,unknown>|null>{
  if(databaseProvider()==='d1'){const row=await legacyDatabase().prepare("SELECT value FROM settings WHERE id='public'").first<{value:string}>();return row?object(row.value):null;}
  const rows=await getPostgres().query("SELECT value FROM lyca.settings WHERE id='public'");return rows[0]?object(rows[0].value):null;
}
export async function savePublicSettings(value:Record<string,unknown>){
  if(databaseProvider()==='d1'){await legacyDatabase().prepare("INSERT INTO settings (id,value) VALUES ('public',?) ON CONFLICT(id) DO UPDATE SET value=excluded.value").bind(JSON.stringify(value)).run();return;}
  await getPostgres().query("INSERT INTO lyca.settings (id,value) VALUES ('public',$1::jsonb) ON CONFLICT(id) DO UPDATE SET value=EXCLUDED.value",[JSON.stringify(value)]);
}
