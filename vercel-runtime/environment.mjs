import {requestContext} from './context.mjs';
export const env = new Proxy({}, {get: (_, name) => requestContext.getStore()?.environment[name]});
