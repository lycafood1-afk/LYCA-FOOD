import * as ingredients from '../customer-and-backend/app/api/ingredients/route.ts';
import * as categories from '../customer-and-backend/app/api/categories/route.ts';
import * as products from '../customer-and-backend/app/api/products/route.ts';
import * as settings from '../customer-and-backend/app/api/settings/route.ts';
import * as catalogue from '../customer-and-backend/app/api/catalogue/route.ts';
import * as upload from '../customer-and-backend/app/api/upload/route.ts';
import * as media from './media.mjs';
import {neon} from '@neondatabase/serverless';
import {requestContext} from './context.mjs';
import {authentication, configured, sameOrigin, sessionUser} from './auth.mjs';

const routes = {ingredients, categories, products, settings, catalogue, upload};
const PHOTO_LIMIT = 4 * 1024 * 1024;
const errorResponse = (error, status) => Response.json({error}, {status, headers: {'Cache-Control': 'no-store'}});
async function limitedRequest(request, url, limit) {
  const headers = new Headers(request.headers);
  // Hosting-specific identity and bridge headers never authorize a Vercel request.
  for (const name of [...headers.keys()]) if (name.startsWith('oai-') || name === 'x-lyca-admin-key') headers.delete(name);
  if (['GET', 'HEAD'].includes(request.method)) return new Request(url, {method: request.method, headers});
  if (Number(headers.get('content-length')) > limit) throw Object.assign(new Error('Request too large.'), {status: 413});
  const reader = request.body?.getReader();
  const chunks = []; let length = 0;
  if (reader) for (;;) {
    const {done, value} = await reader.read(); if (done) break;
    length += value.length;
    if (length > limit) { await reader.cancel(); throw Object.assign(new Error('Request too large.'), {status: 413}); }
    chunks.push(value);
  }
  headers.delete('content-length');
  return new Request(url, {method: request.method, headers, body: Buffer.concat(chunks)});
}
function customerRedirect(pathname, url, environment) {
  if (!environment.CUSTOMER_SITE_URL) return errorResponse('Set CUSTOMER_SITE_URL in the admin Vercel project to open the customer website.', 503);
  const destination = new URL(environment.CUSTOMER_SITE_URL);
  if (destination.protocol !== 'https:' || destination.username || destination.password || destination.pathname !== '/' || destination.search || destination.hash) return errorResponse('CUSTOMER_SITE_URL must be the HTTPS customer website origin.', 503);
  // Assign pathname instead of resolving a user-controlled URL: //evil cannot
  // become a different host. The destination is always the configured customer.
  destination.pathname = '/' + pathname.replace(/^\/customer\/?/, '').replace(/^\/+/, '');
  destination.search = url.search;
  return new Response(null, {status: 307, headers: {Location: destination.href, 'Cache-Control': 'no-store'}});
}

// Optional service injection exercises the production route bundle against real
// PostgreSQL semantics in tests. Production always uses Neon and Vercel Blob.
export function createApplication({env, sql, blob} = {}) {
  return async function application(incoming) {
    try {
      const environment = {...(typeof env === 'function' ? env() : env || process.env)};
      const role = environment.LYCA_SITE_ROLE;
      if (!['admin', 'customer'].includes(role)) return errorResponse('Set LYCA_SITE_ROLE to admin or customer in this Vercel project, then redeploy.', 503);
      const url = new URL(incoming.url);
      const rewritten = url.searchParams.get('__lyca_path');
      if (rewritten) { url.pathname = rewritten; url.searchParams.delete('__lyca_path'); }
      const pathname = url.pathname;
      if (role === 'admin' && /^\/customer(?:\/|$)/.test(pathname)) return customerRedirect(pathname, url, environment);
      const isAuth = ['/login', '/logout', '/signin-with-chatgpt', '/signout-with-chatgpt'].includes(pathname);
      if (!isAuth && !pathname.startsWith('/api/')) return new Response('Not found', {status: 404});
      if (role !== 'admin' && isAuth) return new Response('Not found', {status: 404});
      const isRead = ['GET', 'HEAD'].includes(incoming.method);
      if (!isRead && !sameOrigin(new Request(url, {headers: incoming.headers}))) return errorResponse('A same-origin request is required.', 403);
      const request = await limitedRequest(incoming, url, pathname === '/api/upload' ? PHOTO_LIMIT + 16384 : isAuth ? 8192 : 65536);
      const user = role === 'admin' ? sessionUser(request, environment) : null;
      if (pathname === '/api/admin') {
        if (!isRead) return new Response('Method not allowed', {status: 405});
        const response = Response.json({signedIn: !!user, admin: !!user,
          needsSetup: role === 'admin' && !configured(environment), uploadMaxMB: 4}, {headers: {'Cache-Control': 'no-store'}});
        return request.method === 'HEAD' ? new Response(null, {headers: response.headers}) : response;
      }
      if (!isAuth && !isRead && (role !== 'admin' || !user)) return errorResponse('Administrator access required.', 403);
      if (!environment.DATABASE_URL?.startsWith('postgres')) return errorResponse('The Neon DATABASE_URL is not configured.', 503);
      const database = sql || neon(environment.DATABASE_URL, {fetchOptions: {signal: AbortSignal.timeout(15000)}});
      if (isAuth) return await authentication(request, environment, database, pathname);
      if (pathname === '/api/upload' && !isRead) {
        const form = await request.clone().formData().catch(() => null);
        const image = form?.get('image');
        if (!(image instanceof File) || image.size > PHOTO_LIMIT) return errorResponse('Choose a JPEG, PNG or WebP image up to 4 MB.', 400);
      }
      const match = /^\/api\/media\/([a-f0-9-]+\.(?:webp|png|jpg))$/.exec(pathname);
      const route = match ? media : routes[pathname.slice('/api/'.length)];
      if (!route) return new Response('Not found', {status: 404});
      const method = request.method === 'HEAD' ? 'GET' : request.method;
      if (!route[method]) return new Response('Method not allowed', {status: 405});
      const context = {user, sql: database, environment: {
        DATABASE_URL: environment.DATABASE_URL, CATALOGUE_DATABASE: 'postgresql',
        CATALOGUE_READ_ONLY: role === 'customer' ? 'true' : environment.CATALOGUE_READ_ONLY || 'false',
        ADMIN_EMAIL: role === 'admin' ? environment.ADMIN_EMAIL : undefined,
        BUCKET: blob || media.blobBucket(environment.BLOB_READ_WRITE_TOKEN),
      }};
      return await requestContext.run(context, async () => {
        const response = await route[method](request, match ? {params: Promise.resolve({key: match[1]})} : undefined);
        if (!response.headers.has('Cache-Control')) response.headers.set('Cache-Control', 'no-store');
        response.headers.set('X-Content-Type-Options', 'nosniff');
        return request.method === 'HEAD' ? new Response(null, {status: response.status, headers: response.headers}) : response;
      });
    } catch (error) {
      if (error?.status === 413) return errorResponse('Request is too large. Photos must be up to 4 MB.', 413);
      // Do not log URLs, cookies, passwords, or database connection strings.
      console.error('Vercel service error', {code: typeof error?.code === 'string' ? error.code : 'unavailable'});
      return errorResponse('This service is temporarily unavailable. Check the Vercel environment settings and database setup.', 503);
    }
  };
}
