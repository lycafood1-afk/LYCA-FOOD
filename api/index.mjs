import {createApplication} from '../vercel-runtime/generated/server.mjs';

// Native Vercel Node.js Web Handler. No Cloudflare runtime is needed here.
export default {fetch: createApplication()};
