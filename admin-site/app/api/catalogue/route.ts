import {config,allowed} from '@/lib/admin-access';
export const dynamic='force-dynamic';
export async function GET(req:Request){
  if(!await allowed())return Response.json({error:'Administrator access required for this private preview.'},{status:403});
  const e=config();
  if(!e.CATALOGUE_ORIGIN||!e.CATALOGUE_SERVICE_TOKEN)return Response.json({error:'The catalogue connection is unavailable.'},{status:503});
  const image=new URL(req.url).searchParams.get('image');
  if(image&&!/^[a-f0-9-]+\.(?:webp|png|jpg)$/.test(image))return Response.json({error:'Invalid image reference.'},{status:400});
  try{const r=await fetch(new URL(image?`/api/media/${image}`:'/api/ingredients',e.CATALOGUE_ORIGIN),{headers:{'OAI-Sites-Authorization':`Bearer ${e.CATALOGUE_SERVICE_TOKEN}`},cache:'no-store',redirect:'error'});return new Response(r.body,{status:r.status,headers:{'Content-Type':r.headers.get('content-type')||(image?'application/octet-stream':'application/json'),'Cache-Control':'no-store, max-age=0','X-Content-Type-Options':'nosniff'}})}catch{return Response.json({error:'Catalogue updates are temporarily unavailable.'},{status:503})}
}
