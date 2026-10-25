import {isAdmin,sameOrigin,failure,catalogueReadOnly,migrationInProgress,databaseProvider} from '@/lib/store';
import {saveIngredientRecord,deleteIngredientRecord,deleteAllProducts} from '@/db/repository';
import {getIngredients,getCategories,ingredientSchema,ingredientRevision} from '@/lib/ingredients';
import {z} from 'zod';
export const dynamic='force-dynamic';
const noStore={'Cache-Control':'no-store, max-age=0','X-Content-Type-Options':'nosniff'};
export async function GET(req:Request){
  try{
    const admin=new URL(req.url).searchParams.get('admin')==='1';
    if(admin&&!await isAdmin(req))return Response.json({error:'Administrator access required.'},{status:403,headers:noStore});
    const [ingredients,categories]=await Promise.all([getIngredients(admin),getCategories()]);
    return Response.json({ingredients,categories,revision:await ingredientRevision(ingredients,categories),serverTime:new Date().toISOString(),storage:databaseProvider()},{headers:noStore});
  }catch(e){return failure(e)}
}
const inputSchema=z.object({ingredient:ingredientSchema,expectedVersion:z.number().int().min(0),create:z.boolean()});
export async function POST(req:Request){
  try{
    if(!sameOrigin(req)||!await isAdmin(req))return Response.json({error:'Administrator access required.'},{status:403,headers:noStore});
    if(catalogueReadOnly())return migrationInProgress();
    if(Number(req.headers.get('content-length'))>24000)return Response.json({error:'Ingredient details are too long.'},{status:413});
    let body:unknown;try{body=await req.json()}catch{return Response.json({error:'Send valid ingredient details.'},{status:400})}
    const parsed=inputSchema.safeParse(body);
    if(!parsed.success)return Response.json({error:parsed.error.issues[0]?.message||'Please check the ingredient details.'},{status:400});
    const {ingredient,expectedVersion,create}=parsed.data;
    if(!(await getCategories()).some(c=>c.id===ingredient.category))return Response.json({error:'Choose an existing ingredient category.'},{status:400});
    const all=await getIngredients(true),current=all.find(p=>p.id===ingredient.id);
    if(create&&current)return Response.json({error:'This ingredient already exists. Open it to edit instead.'},{status:409});
    if(!create&&!current)return Response.json({error:'This ingredient no longer exists. Refresh the catalogue.'},{status:404});
    if((current?.version??0)!==expectedVersion)return Response.json({error:'This ingredient changed in another session. Refresh before saving so those changes are preserved.'},{status:409});
    const duplicate=all.find(p=>p.id!==ingredient.id&&p.category===ingredient.category&&p.group.toLowerCase()===ingredient.group.toLowerCase()&&p.name.toLowerCase()===ingredient.name.toLowerCase());
    if(duplicate)return Response.json({error:'An ingredient with this name already exists in this group.'},{status:409});
    const now=new Date().toISOString(),version=expectedVersion+1;
    const saved=await saveIngredientRecord(ingredient.id,ingredient,ingredient.status,expectedVersion,now,create);
    if(!saved)return Response.json({error:'Another administrator saved first. Refresh this ingredient and try again.'},{status:409});
    return Response.json({ingredient:{...ingredient,version,updatedAt:now},savedAt:now},{headers:noStore});
  }catch(e){return failure(e)}
}

export async function DELETE(req:Request){
  try{
    if(!sameOrigin(req)||!await isAdmin(req))return Response.json({error:'Administrator access required.'},{status:403,headers:noStore});
    if(catalogueReadOnly())return migrationInProgress();
    const body:unknown=await req.json().catch(()=>null);
    if(typeof body==='object'&&body!==null&&'all' in body&&body.all===true){
      if(!('confirmation' in body)||body.confirmation!=='DELETE ALL PRODUCTS')return Response.json({error:'Confirm deletion of all products.'},{status:400});
      await deleteAllProducts();return Response.json({deletedAll:true},{headers:noStore});
    }
    const parsed=z.object({id:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(160),expectedVersion:z.number().int().min(0)}).safeParse(body);
    if(!parsed.success)return Response.json({error:'Choose a product and its current version.'},{status:400});
    const current=(await getIngredients(true)).find(p=>p.id===parsed.data.id);
    if(!current)return Response.json({error:'This product has already been deleted.'},{status:404});
    if(!await deleteIngredientRecord(current.id,parsed.data.expectedVersion))return Response.json({error:'This product changed in another session. Refresh before deleting.'},{status:409});
    return Response.json({deleted:true,id:current.id},{headers:noStore});
  }catch(e){return failure(e)}
}
