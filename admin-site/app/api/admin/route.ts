import {getChatGPTUser} from '@/app/chatgpt-auth';
import {allowed} from '@/lib/admin-access';
export async function GET(){return Response.json({signedIn:!!await getChatGPTUser(),admin:await allowed(),needsSetup:false},{headers:{'Cache-Control':'no-store'}})}
