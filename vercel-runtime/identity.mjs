import {requestContext} from './context.mjs';
export async function getChatGPTUser() { return requestContext.getStore()?.user || null; }
