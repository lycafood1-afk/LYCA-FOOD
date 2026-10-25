import {head, put, BlobNotFoundError} from '@vercel/blob';
import {requestContext} from './context.mjs';
const validKey = /^[a-f0-9-]+\.(?:webp|png|jpg)$/;
export function blobBucket(token) {
  return {
    async put(key, bytes, metadata) {
      if (!validKey.test(key) || !token) throw new Error('Photo storage is not configured.');
      await put('lyca/media/' + key, bytes, {
        token, access: 'public', addRandomSuffix: false,
        contentType: metadata.httpMetadata.contentType,
        cacheControlMaxAge: 31536000,
      });
    },
    async url(key) {
      if (!validKey.test(key) || !token) return null;
      try { return (await head('lyca/media/' + key, {token})).url; }
      catch (error) { if (error instanceof BlobNotFoundError) return null; throw error; }
    },
  };
}
export async function GET(_request, {params}) {
  const {key} = await params;
  if (!validKey.test(key)) return new Response('Not found', {status: 404});
  try {
    const url = await requestContext.getStore().environment.BUCKET.url(key);
    if (!url) return new Response('Not found', {status: 404});
    // The public Blob CDN serves bytes directly. Both deployments use this store.
    return new Response(null, {status: 307, headers: {
      Location: url, 'Cache-Control': 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
    }});
  } catch {
    return Response.json({error: 'Photo storage is temporarily unavailable.'}, {status: 503});
  }
}
