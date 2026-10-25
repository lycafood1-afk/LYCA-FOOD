import {GET as ingredients} from '@/app/api/ingredients/route';
import {GET as media} from '@/app/api/media/[key]/route';
export const dynamic='force-dynamic';
export async function GET(req:Request){
  const image=new URL(req.url).searchParams.get('image');
  if(image){
    if(!/^[a-f0-9-]+\.(?:webp|png|jpg)$/.test(image))return Response.json({error:'Invalid image reference.'},{status:400});
    return media(req,{params:Promise.resolve({key:image})});
  }
  return ingredients(new Request(new URL('/api/ingredients',req.url),{headers:req.headers}));
}
