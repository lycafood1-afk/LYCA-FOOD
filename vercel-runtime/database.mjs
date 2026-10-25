import {neon as realNeon} from '@neondatabase/serverless';
import {requestContext} from './context.mjs';
export const neon = (...args) => requestContext.getStore()?.sql || realNeon(...args);
