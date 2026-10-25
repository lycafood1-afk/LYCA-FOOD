import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import seed from '../lib/ingredients-seed.json' with {type:'json'};
import productsSeed from '../db/products-seed.json' with {type:'json'};
import {ensureCategories} from './catalogue-schema.mjs';

export class MigrationValidationError extends Error {}
export const migrationId='lyca-d1-to-postgres-v1';
export function canonical(value){if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';return JSON.stringify(value);}
const parseObject=value=>{const parsed=typeof value==='string'?JSON.parse(value):value;if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new MigrationValidationError('The migration contains an invalid record.');return parsed;};
export function preparePostgresMigration(snapshot={tables:{}}){
  const tables=snapshot.tables||{};
  for(const name of ['ingredients','products','settings'])if(tables[name]&&!Array.isArray(tables[name]))throw new MigrationValidationError('Invalid migration table.');
  const ingredientMap=new Map(seed.ingredients.map(p=>{const {version,updatedAt,...data}=p;return [p.id,{id:p.id,data,status:p.status,version:0,updated_at:null}]}));
  for(const row of tables.ingredients||[]){
    const data=parseObject(row.data),version=Number(row.version),status=row.status;
    if(typeof row.id!=='string'||!Number.isInteger(version)||version<0||!['draft','published','archived'].includes(status)||!row.updated_at||!Number.isFinite(new Date(row.updated_at).valueOf()))throw new MigrationValidationError('An ingredient migration record is invalid.');
    const {version:ignoredVersion,updatedAt:ignoredDate,...details}=data;
    ingredientMap.set(row.id,{id:row.id,data:{...details,id:row.id},status,version,updated_at:new Date(row.updated_at).toISOString()});
  }
  const productMap=new Map(productsSeed.map(p=>[p.id,{id:p.id,data:p,archived:!!p.archived}]));
  for(const row of tables.products||[]){if(typeof row.id!=='string')throw new MigrationValidationError('A product migration record is invalid.');productMap.set(row.id,{id:row.id,data:{...parseObject(row.data),id:row.id},archived:!!row.archived});}
  const settingsMap=new Map([['public',{id:'public',value:{serviceId:'',templateId:'',publicKey:'',responsePromise:''}}]]);
  for(const row of tables.settings||[]){if(typeof row.id!=='string')throw new MigrationValidationError('A settings migration record is invalid.');settingsMap.set(row.id,{id:row.id,value:parseObject(row.value)});}
  const byId=(a,b)=>a.id.localeCompare(b.id);
  const prepared={ingredients:[...ingredientMap.values()].sort(byId),products:[...productMap.values()].sort(byId),settings:[...settingsMap.values()].sort(byId)};
  return {...prepared,hash:createHash('sha256').update(canonical(prepared)).digest('hex')};
}
export async function verifyPostgresMigration(sql,prepared){
  const [ingredients,products,settings]=await Promise.all([
    sql.query('SELECT id,data,status,version,updated_at FROM lyca.ingredients ORDER BY id'),
    sql.query('SELECT id,data,archived FROM lyca.products ORDER BY id'),
    sql.query('SELECT id,value FROM lyca.settings ORDER BY id'),
  ]);
  const compare=(actual,expected,name)=>{if(actual.length!==expected.length)throw new MigrationValidationError(`${name} count does not match the migration.`);const map=new Map(actual.map(row=>[row.id,row]));for(const record of expected){const row=map.get(record.id);if(!row)throw new MigrationValidationError(`A ${name} record is missing.`);for(const key of Object.keys(record)){if(key==='updated_at'&&record[key]===null)continue;const value=key==='updated_at'?new Date(row[key]).toISOString():row[key];if(canonical(value)!==canonical(record[key]))throw new MigrationValidationError(`A ${name} record differs from the source.`);}}};
  compare(ingredients,prepared.ingredients,'ingredient');compare(products,prepared.products,'product');compare(settings,prepared.settings,'settings');
  return {ingredients:ingredients.length,products:products.length,settings:settings.length};
}
export async function migratePostgres(sql,prepared){
  await sql.query('CREATE SCHEMA IF NOT EXISTS lyca');
  await sql.query('CREATE TABLE IF NOT EXISTS lyca.migration_runs (id text PRIMARY KEY, source_hash text NOT NULL, completed_at timestamptz NOT NULL DEFAULT now(), counts jsonb NOT NULL)');
  const existing=await sql.query('SELECT source_hash FROM lyca.migration_runs WHERE id=$1',[migrationId]);
  if(existing.length){if(existing[0].source_hash!==prepared.hash)throw new MigrationValidationError('This database was already migrated from a different snapshot. Existing PostgreSQL data was preserved.');return {alreadyApplied:true,...await verifyPostgresMigration(sql,prepared)};}
  const presence=await sql.query("SELECT table_name FROM information_schema.tables WHERE table_schema='lyca' AND table_name IN ('ingredients','products','settings')");
  for(const row of presence){const name=row.table_name;if(!['ingredients','products','settings'].includes(name))throw new MigrationValidationError('Unexpected table.');const count=await sql.query(`SELECT count(*)::int AS count FROM lyca.${name}`);if(count[0].count)throw new MigrationValidationError('The target schema contains existing data. Nothing was replaced.');}
  const migration=await readFile(new URL('../postgres/migrations/0000_sturdy_zaran.sql',import.meta.url),'utf8');
  const statements=migration.split('--> statement-breakpoint').map(q=>q.trim().replace(/^CREATE SCHEMA /,'CREATE SCHEMA IF NOT EXISTS ').replace(/^CREATE TABLE /,'CREATE TABLE IF NOT EXISTS ')).filter(Boolean);
  const counts={ingredients:prepared.ingredients.length,products:prepared.products.length,settings:prepared.settings.length};
  await sql.transaction([
    ...statements.map(statement=>sql.query(statement)),
    sql.query('INSERT INTO lyca.ingredients (id,data,status,version,updated_at) SELECT id,data,status,version,COALESCE(updated_at,now()) FROM jsonb_to_recordset($1::jsonb) AS records(id text,data jsonb,status text,version integer,updated_at timestamptz)',[JSON.stringify(prepared.ingredients)]),
    sql.query('INSERT INTO lyca.products (id,data,archived) SELECT id,data,archived FROM jsonb_to_recordset($1::jsonb) AS records(id text,data jsonb,archived boolean)',[JSON.stringify(prepared.products)]),
    sql.query('INSERT INTO lyca.settings (id,value) SELECT id,value FROM jsonb_to_recordset($1::jsonb) AS records(id text,value jsonb)',[JSON.stringify(prepared.settings)]),
    sql.query('INSERT INTO lyca.migration_runs (id,source_hash,counts) VALUES ($1,$2,$3::jsonb)',[migrationId,prepared.hash,JSON.stringify(counts)]),
  ],{isolationLevel:'Serializable'});
  await ensureCategories(sql);
  return {alreadyApplied:false,...await verifyPostgresMigration(sql,prepared)};
}
