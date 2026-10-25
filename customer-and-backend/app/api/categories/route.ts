import {z} from 'zod';
import {getCategories} from '@/lib/ingredients';
import {createCategory,updateCategory,deleteCategory} from '@/db/repository';
import {isAdmin,sameOrigin,failure,catalogueReadOnly,migrationInProgress} from '@/lib/store';

const schema=z.object({
  id:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(160),
  title:z.string().trim().min(2).max(100),
  shortTitle:z.string().trim().min(2).max(100),
  description:z.string().trim().max(1500),
  image:z.string().regex(/^\/(?:images\/[a-zA-Z0-9/_-]+\.(?:webp|png|jpg)|api\/media\/[a-f0-9-]+\.(?:webp|png|jpg))$/),
  imageAlt:z.string().trim().min(2).max(200),
  imageCaption:z.string().trim().max(150),
  groups:z.array(z.string().trim().min(2).max(100)).min(1).max(30),
});
export async function GET(){
  try{return Response.json({categories:await getCategories()},{headers:{'Cache-Control':'no-store'}});}
  catch(error){return failure(error);}
}
export async function POST(req:Request){
  try{
    if(!sameOrigin(req)||!await isAdmin(req))return Response.json({error:'Administrator access required.'},{status:403});
    if(catalogueReadOnly())return migrationInProgress();
    if(Number(req.headers.get('content-length'))>12000)return Response.json({error:'Category details are too long.'},{status:413});
    const parsed=schema.safeParse(await req.json().catch(()=>null));
    if(!parsed.success)return Response.json({error:parsed.error.issues[0]?.message||'Complete the category details.'},{status:400});
    if(!await createCategory(parsed.data))return Response.json({error:'A category with this name already exists.'},{status:409});
    return Response.json({category:{...parsed.data,version:1}},{headers:{'Cache-Control':'no-store'}});
  }catch(error){return failure(error);}
}
export async function PATCH(req:Request){
  try{
    if(!sameOrigin(req)||!await isAdmin(req))return Response.json({error:'Administrator access required.'},{status:403});
    if(catalogueReadOnly())return migrationInProgress();
    const parsed=z.object({category:schema,expectedVersion:z.number().int().min(1)}).safeParse(await req.json().catch(()=>null));
    if(!parsed.success)return Response.json({error:'Complete the category details and refresh its current version.'},{status:400});
    const version=await updateCategory(parsed.data.category,parsed.data.expectedVersion);
    if(version===null)return Response.json({error:'This category changed or was deleted. Refresh before saving.'},{status:409});
    return Response.json({category:{...parsed.data.category,version}},{headers:{'Cache-Control':'no-store'}});
  }catch(error){
    if(typeof error==='object'&&error&&'code' in error&&error.code==='23505')return Response.json({error:'A category with this name already exists.'},{status:409});
    return failure(error);
  }
}
export async function DELETE(req:Request){
  try{
    if(!sameOrigin(req)||!await isAdmin(req))return Response.json({error:'Administrator access required.'},{status:403});
    if(catalogueReadOnly())return migrationInProgress();
    const parsed=z.object({id:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(160),expectedVersion:z.number().int().min(1),deleteIngredients:z.boolean(),confirmation:z.literal('DELETE CATEGORY')}).safeParse(await req.json().catch(()=>null));
    if(!parsed.success)return Response.json({error:'Confirm the category deletion and its current version.'},{status:400});
    const result=await deleteCategory(parsed.data.id,parsed.data.expectedVersion,parsed.data.deleteIngredients);
    if(!result.deleted)return Response.json({error:'The category changed, was deleted, or still contains ingredients. Refresh and confirm whether to remove its ingredients too.'},{status:409});
    return Response.json(result,{headers:{'Cache-Control':'no-store'}});
  }catch(error){return failure(error);}
}
