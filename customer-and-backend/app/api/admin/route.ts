import {isAdmin,failure} from '@/lib/store';
import {getChatGPTUser} from '@/app/chatgpt-auth';
export async function GET(req:Request){try{const user=await getChatGPTUser();return Response.json({signedIn:!!user,admin:await isAdmin(req),needsSetup:false},{headers:{'Cache-Control':'no-store'}})}catch(e){return failure(e)}}
