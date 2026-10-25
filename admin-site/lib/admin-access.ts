import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
export const config=()=>env as unknown as {ADMIN_EMAIL?:string;CATALOGUE_ORIGIN?:string;CATALOGUE_SERVICE_TOKEN?:string;ADMIN_BRIDGE_KEY?:string};
export async function allowed(){const user=await getChatGPTUser();const email=config().ADMIN_EMAIL;return !!user&&!!email&&user.email.toLowerCase()===email.toLowerCase()}
