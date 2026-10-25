import {config} from '@/lib/admin-access';
export async function GET(req:Request,{params}:{params:Promise<{path?:string[]}>}){
  const origin=config().CATALOGUE_ORIGIN;
  if(!origin)return new Response('The customer site connection is unavailable.',{status:503});
  const {path=[]}=await params;
  const url=new URL('/'+path.map(encodeURIComponent).join('/'),origin);
  url.search=new URL(req.url).search;
  return Response.redirect(url,307);
}
