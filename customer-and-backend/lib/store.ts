import { env } from 'cloudflare:workers';
import {type Product} from './catalogue';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {productRecords,publicSettings} from '@/db/repository';
export {catalogueReadOnly,databaseProvider} from '@/db/postgres';
export const bucket=()=> (env as unknown as {BUCKET:R2Bucket}).BUCKET;
export async function catalogue(includeArchived=false):Promise<Product[]>{
const rows=await productRecords();
return rows.map(r=>({...r.data,archived:r.archived} as Product)).filter(p=>includeArchived||!p.archived);
}
export async function getSettings(){return await publicSettings()||{serviceId:'',templateId:'',publicKey:'',responsePromise:''};}
export async function isAdmin(req?:Request){
 const e=env as unknown as {ADMIN_EMAIL?:string;ADMIN_BRIDGE_KEY?:string};
 const bridge=req?.headers.get('x-lyca-admin-key');
 if(bridge&&e.ADMIN_BRIDGE_KEY){const enc=new TextEncoder();const [a,b]=await Promise.all([crypto.subtle.digest('SHA-256',enc.encode(bridge)),crypto.subtle.digest('SHA-256',enc.encode(e.ADMIN_BRIDGE_KEY))]);const aa=new Uint8Array(a),bb=new Uint8Array(b);let diff=0;for(let i=0;i<aa.length;i++)diff|=aa[i]^bb[i];if(diff===0)return true;}
 const user=await getChatGPTUser();return !!user&&!!e.ADMIN_EMAIL&&user.email.toLowerCase()===e.ADMIN_EMAIL.toLowerCase();
}
export function sameOrigin(req:Request){const origin=req.headers.get('origin');return !origin||origin===new URL(req.url).origin;}
export function failure(e:unknown){console.error('Catalogue request failed',{code:typeof e==='object'&&e&&'code' in e?String(e.code):'unavailable'});return Response.json({error:'This service is temporarily unavailable. Please try again.'},{status:503});}
export function migrationInProgress(){return Response.json({error:'The catalogue is being migrated. Please try saving again shortly.'},{status:503,headers:{'Retry-After':'30','Cache-Control':'no-store'}});}
