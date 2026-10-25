import {createHmac, randomBytes, scrypt as nodeScrypt, timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt = promisify(nodeScrypt);
const COOKIE = '__Host-lyca_admin';
const SESSION_SECONDS = 8 * 60 * 60;
const noStore = {'Cache-Control': 'private, no-store', 'Content-Type': 'text/html; charset=utf-8',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"};
export async function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const hash = await scrypt(password, salt, 64);
  return `scrypt:${salt}:${hash.toString('hex')}`;
}
export function validPasswordHash(value = '') { return /^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(value); }
export async function checkPassword(password, encoded) {
  if (!validPasswordHash(encoded)) return false;
  const [, salt, expected] = encoded.split(':');
  const actual = await scrypt(password, salt, 64);
  return timingSafeEqual(actual, Buffer.from(expected, 'hex'));
}
export function configured(env) {
  return !!env.ADMIN_EMAIL?.trim() && validPasswordHash(env.ADMIN_PASSWORD_HASH) && env.SESSION_SECRET?.length >= 32;
}
function signature(value, env) {
  return createHmac('sha256', env.SESSION_SECRET).update(env.ADMIN_PASSWORD_HASH).update('\0').update(value).digest('base64url');
}
export function createSession(env, origin, now = Date.now()) {
  const data = Buffer.from(JSON.stringify({email: env.ADMIN_EMAIL.trim().toLowerCase(), origin,
    exp: Math.floor(now / 1000) + SESSION_SECONDS, nonce: randomBytes(16).toString('hex')})).toString('base64url');
  return `${data}.${signature(data, env)}`;
}
export function sessionUser(request, env, now = Date.now()) {
  if (!configured(env)) return null;
  const token = request.headers.get('cookie')?.split(';').map(v => v.trim()).find(v => v.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
  if (!token || token.length > 2048) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const expected = Buffer.from(signature(parts[0], env));
  const received = Buffer.from(parts[1]);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  try {
    const data = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    if (data.exp <= Math.floor(now / 1000) || data.exp > Math.floor(now / 1000) + SESSION_SECONDS || data.origin !== new URL(request.url).origin || data.email !== env.ADMIN_EMAIL.trim().toLowerCase()) return null;
    return {userId: 'lyca-vercel-owner', email: data.email, displayName: 'LYCA administrator', fullName: null};
  } catch { return null; }
}
export function sameOrigin(request) {
  return request.headers.get('origin') === new URL(request.url).origin && request.headers.get('sec-fetch-site') !== 'cross-site';
}
function page(message = '', logout = false, status = 200) {
  // All messages are fixed strings; user-supplied values are never interpolated.
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>LYCA administrator</title><style>*{box-sizing:border-box}body{margin:0;background:#fcfbfe;color:#302439;font:16px/1.6 system-ui}main{max-width:460px;margin:10vh auto;padding:32px;background:#fff;border:1px solid #dfd7e6;border-radius:18px}h1{line-height:1.15}label{display:block;margin:18px 0}input,button{font:inherit;width:100%;padding:12px;border-radius:8px;border:1px solid #cfc6da}button{background:#48335f;color:white;cursor:pointer}a{color:#48335f}.message{color:#9b2339}</style></head><body><main><p>LYCA INGREDIENT STUDIO</p><h1>${logout ? 'Sign out' : 'Administrator sign-in'}</h1>${message ? `<p class="message" role="alert">${message}</p>` : ''}<form method="post" action="${logout ? '/logout' : '/login'}">${logout ? '<p>Sign out of this browser?</p>' : '<label>Email<input name="email" type="email" autocomplete="username" required maxlength="254"></label><label>Password<input name="password" type="password" autocomplete="current-password" required maxlength="256"></label>'}<button>${logout ? 'Sign out' : 'Sign in'}</button></form><p><a href="/">Back to admin</a></p></main></body></html>`, {status, headers: noStore});
}
async function attemptsAllowed(request, env, sql) {
  // These counters live in PostgreSQL, so cold starts and multiple instances
  // cannot reset them. Vercel supplies/overwrites the client forwarding header.
  const ip = request.headers.get('x-vercel-forwarded-for') || request.headers.get('x-forwarded-for') || 'unknown';
  const keys = ['ip:' + ip.split(',')[0].trim(), 'account:' + env.ADMIN_EMAIL.trim().toLowerCase()]
    .map(value => createHmac('sha256', env.SESSION_SECRET).update(value).digest('hex'));
  const results = await sql.transaction([
    ...keys.map(bucket => sql.query(`INSERT INTO lyca.admin_login_attempts (bucket,window_start,attempts)
      VALUES ($1,now(),1) ON CONFLICT (bucket) DO UPDATE SET
      attempts=CASE WHEN lyca.admin_login_attempts.window_start < now()-interval '15 minutes' THEN 1 ELSE lyca.admin_login_attempts.attempts+1 END,
      window_start=CASE WHEN lyca.admin_login_attempts.window_start < now()-interval '15 minutes' THEN now() ELSE lyca.admin_login_attempts.window_start END
      RETURNING attempts`, [bucket])),
    sql.query("DELETE FROM lyca.admin_login_attempts WHERE window_start < now()-interval '1 day'"),
  ]);
  return Number(results[0][0].attempts) <= 10 && Number(results[1][0].attempts) <= 40;
}
export async function authentication(request, env, sql, pathname) {
  const logout = pathname === '/logout' || pathname === '/signout-with-chatgpt';
  if (!['GET', 'POST', 'HEAD'].includes(request.method)) return new Response('Method not allowed', {status: 405});
  if (request.method !== 'POST') return page('', logout);
  if (!sameOrigin(request)) return new Response('Forbidden', {status: 403});
  if (logout) return new Response(null, {status: 303, headers: {
    Location: '/', 'Cache-Control': 'no-store',
    'Set-Cookie': `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
  }});
  if (!configured(env)) return page('Administrator sign-in is not configured. Follow VERCEL-DEPLOY.md.', false, 503);
  const body = await request.formData().catch(() => null);
  const email = body?.get('email'), password = body?.get('password');
  if (typeof email !== 'string' || typeof password !== 'string' || email.length > 254 || password.length > 256) return page('Enter your email and password.', false, 400);
  try {
    if (!await attemptsAllowed(request, env, sql)) {
      const response = page('Too many sign-in attempts. Try again in 15 minutes.', false, 429);
      response.headers.set('Retry-After', '900'); return response;
    }
    const validPassword = await checkPassword(password, env.ADMIN_PASSWORD_HASH);
    if (!validPassword || email.trim().toLowerCase() !== env.ADMIN_EMAIL.trim().toLowerCase()) return page('Email or password is incorrect.', false, 401);
    return new Response(null, {status: 303, headers: {Location: '/', 'Cache-Control': 'no-store',
      'Set-Cookie': `${COOKIE}=${createSession(env, new URL(request.url).origin)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`}});
  } catch {
    return page('Sign-in is temporarily unavailable. Check the database settings and run VERCEL-SETUP.sql.', false, 503);
  }
}
