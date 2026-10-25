import {savePublicSettings} from '@/db/repository';
import {getSettings,isAdmin,sameOrigin,failure,catalogueReadOnly,migrationInProgress} from '@/lib/store';
import {z} from 'zod';
export async function GET(){try{return Response.json(await getSettings(),{headers:{'Cache-Control':'no-store'}})}catch(e){return failure(e)}}
export async function POST(req:Request){try{if(!sameOrigin(req)||!await isAdmin(req))return Response.json({error:'Administrator access required'},{status:403});if(catalogueReadOnly())return migrationInProgress();const schema=z.object({serviceId:z.string().max(150),templateId:z.string().max(150),publicKey:z.string().max(200),responsePromise:z.string().max(250)});const p=schema.safeParse(await req.json());if(!p.success)return Response.json({error:'Invalid settings'},{status:400});await savePublicSettings(p.data);return Response.json({ok:true})}catch(e){return failure(e)}}
