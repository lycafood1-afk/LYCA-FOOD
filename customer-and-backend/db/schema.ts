import {pgSchema,text,integer,jsonb,boolean,timestamp,check,uniqueIndex} from 'drizzle-orm/pg-core';
import {sql} from 'drizzle-orm';
export const lyca=pgSchema('lyca');
export const products=lyca.table('products',{id:text('id').primaryKey(),data:jsonb('data').notNull(),archived:boolean('archived').notNull().default(false)});
export const settings=lyca.table('settings',{id:text('id').primaryKey(),value:jsonb('value').notNull()});
export const catalogueMetadata=lyca.table('catalogue_metadata',{id:text('id').primaryKey(),value:jsonb('value').notNull()});
export const categories=lyca.table('categories',{
  id:text('id').primaryKey(),data:jsonb('data').notNull(),sortOrder:integer('sort_order').notNull().default(0),version:integer('version').notNull().default(1),
},table=>[uniqueIndex('category_title_unique').on(sql`lower(${table.data}->>'title')`)]);
export const ingredients=lyca.table('ingredients',{
  id:text('id').primaryKey(),data:jsonb('data').notNull(),status:text('status').notNull().default('draft'),
  version:integer('version').notNull().default(1),updatedAt:timestamp('updated_at',{withTimezone:true,mode:'string'}).notNull().defaultNow(),
},table=>[check('ingredient_status',sql`${table.status} IN ('draft','published','archived')`),check('ingredient_version',sql`${table.version} >= 0`)]);
