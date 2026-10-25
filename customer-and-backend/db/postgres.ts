import {env} from 'cloudflare:workers';
import {neon} from '@neondatabase/serverless';

type DatabaseEnvironment={DATABASE_URL?:string;CATALOGUE_DATABASE?:string;CATALOGUE_READ_ONLY?:string;DB?:D1Database};
export const databaseEnvironment=()=>env as unknown as DatabaseEnvironment;
export function databaseProvider():'postgresql'|'d1'{
  const selected=databaseEnvironment().CATALOGUE_DATABASE?.trim().toLowerCase()||'postgresql';
  if(selected==='postgres'||selected==='postgresql')return 'postgresql';
  if(selected==='d1')return 'd1';
  throw new Error('Unsupported catalogue database configuration.');
}
export function getPostgres(){
  const connection=databaseEnvironment().DATABASE_URL?.trim();
  if(!connection)throw new Error('PostgreSQL DATABASE_URL is not configured.');
  if(!/^postgres(?:ql)?:\/\//.test(connection))throw new Error('Invalid PostgreSQL connection configuration.');
  return neon(connection,{fetchOptions:{signal:AbortSignal.timeout(15000)}});
}
export function legacyDatabase(){const database=databaseEnvironment().DB;if(!database)throw new Error('Legacy migration database is unavailable.');return database;}
export function catalogueReadOnly(){return ['1','true'].includes(databaseEnvironment().CATALOGUE_READ_ONLY?.toLowerCase()||'');}
