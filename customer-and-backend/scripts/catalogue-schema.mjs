import {readFile} from 'node:fs/promises';
import seed from '../lib/ingredients-seed.json' with {type:'json'};

export async function ensureCategories(sql){
  for(const file of ['0001_category_management.sql','0002_category_lifecycle.sql']){
    const schema=await readFile(new URL('../postgres/migrations/'+file,import.meta.url),'utf8');
    const statements=schema.split('--> statement-breakpoint').map(q=>q.trim().replace(/^CREATE TABLE /,'CREATE TABLE IF NOT EXISTS ').replace(/^CREATE UNIQUE INDEX /,'CREATE UNIQUE INDEX IF NOT EXISTS ').replace(/ADD COLUMN /g,'ADD COLUMN IF NOT EXISTS ')).filter(Boolean);
    await sql.transaction(statements.map(q=>sql.query(q)));
  }
  // The marker makes defaults a one-time bootstrap, so a deleted category is
  // never silently reinserted by a restart or a repeated SQL setup.
  const categories=seed.categories.map((c,index)=>({id:c.id,data:{...c,description:'',imageCaption:c.shortTitle.toUpperCase()},sort_order:index}));
  await sql.query(`WITH first_run AS (
    INSERT INTO lyca.catalogue_metadata (id,value) VALUES ('category-defaults-v1','{"initialized":true}'::jsonb)
    ON CONFLICT DO NOTHING RETURNING id
  ) INSERT INTO lyca.categories (id,data,sort_order)
    SELECT id,data,sort_order FROM jsonb_to_recordset($1::jsonb) AS records(id text,data jsonb,sort_order integer)
    WHERE EXISTS(SELECT 1 FROM first_run) ON CONFLICT DO NOTHING`,[JSON.stringify(categories)]);

}

// Repeatable setup: create missing tables and category defaults, without
// importing any demo products or modifying existing catalogue records.
export async function initializeCatalogue(sql){
  const schema=await readFile(new URL('../postgres/migrations/0000_sturdy_zaran.sql',import.meta.url),'utf8');
  const statements=schema.split('--> statement-breakpoint').map(q=>q.trim().replace(/^CREATE SCHEMA /,'CREATE SCHEMA IF NOT EXISTS ').replace(/^CREATE TABLE /,'CREATE TABLE IF NOT EXISTS ')).filter(Boolean);
  await sql.transaction(statements.map(statement=>sql.query(statement)));
  await ensureCategories(sql);
}
