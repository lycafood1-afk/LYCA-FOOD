import seed from './ingredients-seed.json';
import {ingredientRecords,categoryRecords} from '@/db/repository';
import {z} from 'zod';

export const ingredientCategories=seed.categories;
export async function getCategories(){return await categoryRecords();}
export const ingredientSchema=z.object({
  id:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(160),
  name:z.string().trim().min(2).max(150),
  category:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(160),
  group:z.string().trim().min(2).max(100), description:z.string().trim().max(2500),
  image:z.string().refine(v=>/^\/images\/[a-zA-Z0-9/_-]+\.(?:webp|png|jpg)$/.test(v)||/^\/api\/media\/[a-f0-9-]+\.(?:webp|png|jpg)$/.test(v),'Choose a catalogue image or upload a photo.'),
  imageAlt:z.string().trim().min(2).max(200), specifications:z.string().trim().max(3000),
  partner:z.enum(['','ECOM','Foods & Inns','Medibel','Appco','Zentis']),
  status:z.enum(['draft','published','archived']),
});
export type Ingredient=z.infer<typeof ingredientSchema>&{version:number;updatedAt:string|null};
export async function getIngredients(includeUnpublished=false):Promise<Ingredient[]>{
  const rows=await ingredientRecords();
  return rows.map(row=>({...row.data,id:row.id,status:row.status,version:row.version,updatedAt:row.updatedAt} as Ingredient)).filter(p=>includeUnpublished||p.status==='published');
}
export async function ingredientRevision(products:Ingredient[],categories:unknown[]=[]){
  const raw=products.map(p=>`${p.id}:${p.version}:${p.status}`).sort().join('|')+'|'+JSON.stringify(categories);
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw));
  return [...new Uint8Array(hash)].map(v=>v.toString(16).padStart(2,'0')).join('');
}
