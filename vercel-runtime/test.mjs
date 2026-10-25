import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '../local-runtime/node_modules/@electric-sql/pglite/dist/index.js';
import {bundleServer, buildDeployment} from './build.mjs';
import {hashPassword, createSession, sessionUser} from './auth.mjs';

test('two Vercel deployments share catalogue and photos with isolated administrator access', async t => {
  await bundleServer();
  const {createApplication} = await import('./generated/server.mjs');
  const db = new PGlite(); await db.waitReady;
  t.after(() => db.close());
  await db.exec(await readFile(new URL('../POSTGRESQL-SETUP.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../VERCEL-SETUP.sql', import.meta.url), 'utf8'));
  const sql = {
    query(text, params = []) {return {spec: {text, params}, then(resolve, reject) {return db.query(text, params).then(r => r.rows).then(resolve, reject);}};},
    transaction(queries) {return db.transaction(async tx => {const results = []; for (const {spec} of queries) results.push((await tx.query(spec.text, spec.params)).rows); return results;});},
  };
  const objects = new Map();
  const blob = {
    async put(key, bytes, metadata) {objects.set(key, {bytes, metadata});},
    async url(key) {return objects.has(key) ? 'https://photos.public.blob.vercel-storage.com/lyca/media/' + key : null;},
  };
  const password = 'A test password only 123!';
  const env = {DATABASE_URL: 'postgresql://test.invalid/lyca', ADMIN_EMAIL: 'owner@example.com',
    ADMIN_PASSWORD_HASH: await hashPassword(password), SESSION_SECRET: 'test-only-session-secret-with-at-least-32-characters',
    CUSTOMER_SITE_URL: 'https://lyca-customer.vercel.app'};
  const adminOrigin = 'https://lyca-admin.vercel.app', customerOrigin = env.CUSTOMER_SITE_URL;
  const admin = createApplication({env: {...env, LYCA_SITE_ROLE: 'admin'}, sql, blob});
  const customer = createApplication({env: {...env, LYCA_SITE_ROLE: 'customer'}, sql, blob});
  let cookie = '';
  async function call(app, origin, route, {method = 'GET', data, headers = {}, authenticated = false} = {}) {
    const h = new Headers(headers); if (authenticated) h.set('Cookie', cookie);
    if (!['GET', 'HEAD'].includes(method) && !h.has('Origin')) h.set('Origin', origin);
    let body;
    if (data instanceof FormData || data instanceof URLSearchParams) body = data;
    else if (data !== undefined) {h.set('Content-Type', 'application/json'); body = JSON.stringify(data);}
    return app(new Request(origin + route, {method, headers: h, body}));
  }
  const a = (route, options) => call(admin, adminOrigin, route, options);
  const c = (route, options) => call(customer, customerOrigin, route, options);
  let category, photo, ingredient;
  await t.test('public catalogue starts empty and default groups have valid editable names', async () => {
    const response = await c('/api/catalogue'); assert.equal(response.status, 200);
    const feed = await response.json(); assert.equal(feed.storage, 'postgresql');
    assert.equal(feed.ingredients.length, 0); assert.equal(feed.categories.length, 7);
    assert.ok(feed.categories.every(value => value.groups.every(group => typeof group === 'string')));
    assert.match(response.headers.get('cache-control'), /no-store/);
  });
  await t.test('sign-in verifies credentials and sets a signed secure session', async () => {
    assert.equal((await a('/login')).status, 200);
    const invalid = await a('/login', {method: 'POST', data: new URLSearchParams({email: env.ADMIN_EMAIL, password: 'wrong'})});
    assert.equal(invalid.status, 401);
    const response = await a('/login', {method: 'POST', data: new URLSearchParams({email: env.ADMIN_EMAIL.toUpperCase(), password})});
    assert.equal(response.status, 303); assert.equal(response.headers.get('location'), '/');
    const setCookie = response.headers.get('set-cookie');
    for (const flag of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/', 'Max-Age=28800']) assert.ok(setCookie.includes(flag));
    assert.ok(!setCookie.includes(password)); cookie = setCookie.split(';')[0];
    assert.equal((await (await a('/api/admin', {authenticated: true})).json()).admin, true);
    assert.equal((await (await a('/api/admin')).json()).uploadMaxMB, 4);
  });
  await t.test('customer writes, cross-origin writes and forged hosting identity are rejected', async () => {
    const forged = {'oai-authenticated-user-id': 'owner', 'oai-authenticated-user-email': env.ADMIN_EMAIL, 'x-lyca-admin-key': env.SESSION_SECRET};
    assert.equal((await a('/api/categories', {method: 'POST', data: {}, headers: forged})).status, 403);
    assert.equal((await c('/api/categories', {method: 'POST', data: {}, headers: {Cookie: cookie, ...forged}})).status, 403);
    assert.equal((await a('/api/categories', {method: 'POST', data: {}, authenticated: true, headers: {Origin: 'https://evil.example'}})).status, 403);
    assert.equal((await a('/login', {method: 'POST', data: new URLSearchParams({email: env.ADMIN_EMAIL, password}), headers: {Origin: 'https://evil.example'}})).status, 403);
    assert.equal((await c('/api/ingredients?admin=1', {headers: {Cookie: cookie, ...forged}})).status, 403);
    assert.equal((await c('/login')).status, 404);
  });
  await t.test('photo uploads use a shared durable store and are served by its public CDN', async () => {
    const form = new FormData(); form.append('image', new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], 'photo.png', {type: 'image/png'}));
    const response = await a('/api/upload', {method: 'POST', data: form, authenticated: true}); assert.equal(response.status, 200);
    photo = (await response.json()).url; assert.match(photo, /^\/api\/media\/[a-f0-9-]+\.png$/);
    const key = photo.split('/').at(-1);
    assert.equal(objects.get(key).metadata.httpMetadata.contentType, 'image/png');
    for (const route of [photo, '/api/catalogue?image=' + key]) {
      const image = await c(route); assert.equal(image.status, 307);
      assert.equal(image.headers.get('location'), await blob.url(key));
    }
    const invalid = new FormData(); invalid.append('image', new File(['bad'], 'bad.png', {type: 'image/png'}));
    assert.equal((await a('/api/upload', {method: 'POST', data: invalid, authenticated: true})).status, 400);
    const large = new FormData(); large.append('image', new File([new Uint8Array(4 * 1024 * 1024 + 1)], 'large.png'));
    assert.equal((await a('/api/upload', {method: 'POST', data: large, authenticated: true})).status, 400);
    assert.equal((await c('/api/media/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.png')).status, 404);
  });
  await t.test('category create/edit and published ingredient changes appear in a separate customer deployment', async () => {
    category = {id: 'vercel-category', title: 'Vercel Category', shortTitle: 'Vercel Category', description: 'Custom customer family',
      image: photo, imageAlt: 'My category photo', imageCaption: 'My family', groups: ['General']};
    const created = await a('/api/categories', {method: 'POST', data: category, authenticated: true}); assert.equal(created.status, 200);
    assert.ok((await (await c('/api/catalogue')).json()).categories.some(value => value.id === category.id && value.image === photo));
    ingredient = {id: 'vercel-ingredient', name: 'Mango Test', category: category.id, group: 'General', description: 'Mango ingredient',
      image: photo, imageAlt: 'Mango photo', specifications: '20 kg', partner: 'ECOM', status: 'draft'};
    assert.equal((await a('/api/ingredients', {method: 'POST', data: {ingredient, expectedVersion: 0, create: true}, authenticated: true})).status, 200);
    assert.equal((await (await c('/api/catalogue')).json()).ingredients.length, 0);
    ingredient = {...ingredient, status: 'published'};
    assert.equal((await a('/api/ingredients', {method: 'POST', data: {ingredient, expectedVersion: 1, create: false}, authenticated: true})).status, 200);
    const feed = await (await c('/api/catalogue')).json(); assert.equal(feed.ingredients[0].name, ingredient.name); assert.equal(feed.ingredients[0].version, 2);
    category = {...category, title: 'Changed Family'};
    assert.equal((await a('/api/categories', {method: 'PATCH', data: {category, expectedVersion: 1}, authenticated: true})).status, 200);
    assert.ok((await (await c('/api/catalogue')).json()).categories.some(value => value.id === category.id && value.title === 'Changed Family'));
    assert.equal((await a('/api/categories', {method: 'PATCH', data: {category, expectedVersion: 1}, authenticated: true})).status, 409);
  });
  await t.test('concurrent admin and public reads keep private drafts isolated per request', async () => {
    const draft = {...ingredient, id: 'private-draft', name: 'Private Draft', status: 'draft'};
    assert.equal((await a('/api/ingredients', {method: 'POST', data: {ingredient: draft, expectedVersion: 0, create: true}, authenticated: true})).status, 200);
    const responses = await Promise.all(Array.from({length: 8}, (_, index) => index % 2 ? a('/api/ingredients?admin=1', {authenticated: true}) : c('/api/catalogue')));
    for (let index = 0; index < responses.length; index++) {
      assert.equal(responses[index].status, 200); const body = await responses[index].json();
      assert.equal(body.ingredients.some(value => value.id === draft.id), !!(index % 2));
    }
  });
  await t.test('deletion is synchronized and survives new function instances and repeated SQL setup', async () => {
    assert.equal((await a('/api/ingredients', {method: 'DELETE', data: {id: ingredient.id, expectedVersion: 1}, authenticated: true})).status, 409);
    assert.equal((await a('/api/ingredients', {method: 'DELETE', data: {id: ingredient.id, expectedVersion: 2}, authenticated: true})).status, 200);
    assert.equal((await (await c('/api/catalogue')).json()).ingredients.length, 0);
    assert.equal((await a('/api/categories', {method: 'DELETE', data: {id: category.id, expectedVersion: 2, deleteIngredients: false, confirmation: 'DELETE CATEGORY'}, authenticated: true})).status, 409);
    assert.equal((await a('/api/categories', {method: 'DELETE', data: {id: category.id, expectedVersion: 2, deleteIngredients: true, confirmation: 'DELETE CATEGORY'}, authenticated: true})).status, 200);
    const defaultCategory = (await (await c('/api/catalogue')).json()).categories[0];
    assert.equal((await a('/api/categories', {method: 'DELETE', data: {id: defaultCategory.id, expectedVersion: defaultCategory.version, deleteIngredients: false, confirmation: 'DELETE CATEGORY'}, authenticated: true})).status, 200);
    await db.exec(await readFile(new URL('../POSTGRESQL-SETUP.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../VERCEL-SETUP.sql', import.meta.url), 'utf8'));
    const freshCustomer = createApplication({env: {...env, LYCA_SITE_ROLE: 'customer'}, sql, blob});
    const feed = await (await call(freshCustomer, customerOrigin, '/api/catalogue')).json();
    assert.ok(!feed.categories.some(value => [category.id, defaultCategory.id].includes(value.id)));
    assert.equal(feed.ingredients.length, 0);
    await db.query("INSERT INTO lyca.products(id,data) VALUES ('legacy-test','{}'::jsonb)");
    assert.equal((await a('/api/ingredients', {method: 'DELETE', data: {all: true, confirmation: 'wrong'}, authenticated: true})).status, 400);
    assert.equal((await a('/api/ingredients', {method: 'DELETE', data: {all: true, confirmation: 'DELETE ALL PRODUCTS'}, authenticated: true})).status, 200);
    assert.equal((await db.query('SELECT * FROM lyca.products')).rows.length, 0);
  });
  await t.test('sessions reject tampering, expiry, other origins and secret/password rotation', async () => {
    const request = value => new Request(adminOrigin + '/', {headers: {Cookie: '__Host-lyca_admin=' + value}});
    const token = createSession(env, adminOrigin);
    assert.ok(sessionUser(request(token), env));
    assert.equal(sessionUser(request(token + 'x'), env), null);
    assert.equal(sessionUser(request(token), {...env, SESSION_SECRET: 'rotated-session-secret-with-at-least-32-characters'}), null);
    assert.equal(sessionUser(request(token), {...env, ADMIN_PASSWORD_HASH: await hashPassword('another test password')}), null);
    assert.equal(sessionUser(new Request(customerOrigin + '/', {headers: {Cookie: '__Host-lyca_admin=' + token}}), env), null);
    assert.equal(sessionUser(request(createSession(env, adminOrigin, Date.now() - 9 * 3600000)), env), null);
    const response = await a('/logout', {method: 'POST', authenticated: true}); assert.equal(response.status, 303);
    assert.match(response.headers.get('set-cookie'), /Max-Age=0/);
    // GET only presents a confirmation; it does not mutate the session.
    assert.equal((await a('/logout')).headers.get('set-cookie'), null);
  });
  await t.test('login throttling persists across server instances without storing raw IPs or passwords', async () => {
    const freshAdmin = createApplication({env: {...env, LYCA_SITE_ROLE: 'admin'}, sql, blob});
    const request = () => new Request(adminOrigin + '/login', {method: 'POST', headers: {Origin: adminOrigin, 'x-vercel-forwarded-for': '203.0.113.4'}, body: new URLSearchParams({email: env.ADMIN_EMAIL, password: 'wrong'})});
    for (let index = 0; index < 10; index++) assert.equal((await (index % 2 ? freshAdmin : admin)(request())).status, 401);
    const limited = await freshAdmin(request()); assert.equal(limited.status, 429); assert.equal(limited.headers.get('retry-after'), '900');
    const records = (await db.query('SELECT * FROM lyca.admin_login_attempts')).rows;
    assert.ok(records.every(value => /^[a-f0-9]{64}$/.test(value.bucket)));
  });
  await t.test('rewritten API paths, customer links, HEAD requests and missing configuration behave clearly', async () => {
    assert.equal((await a('/api/index?__lyca_path=/api/admin', {authenticated: true})).status, 200);
    const redirect = await a('/customer/products?q=mango'); assert.equal(redirect.headers.get('location'), customerOrigin + '/products?q=mango');
    const safeRedirect = await a('/customer//evil.example'); assert.ok(safeRedirect.headers.get('location').startsWith(customerOrigin + '/'));
    const response = await c('/api/catalogue', {method: 'HEAD'}); assert.equal(response.status, 200); assert.equal(await response.text(), '');
    assert.equal((await createApplication({env: {}, sql})(new Request(customerOrigin + '/api/catalogue'))).status, 503);
    assert.equal((await createApplication({env: {LYCA_SITE_ROLE: 'customer'}, sql})(new Request(customerOrigin + '/api/catalogue'))).status, 503);
  });
});

test('both role builds contain the correct frontend, fonts, photos and bundled Node API', async () => {
  for (const role of ['admin', 'customer']) {
    await buildDeployment(role);
    const html = await readFile(new URL('../vercel-public/index.html', import.meta.url), 'utf8');
    assert.match(html, role === 'admin' ? /\/admin-assets\/assets\// : /\/customer\/assets\//);
    for (const url of [...html.matchAll(/(?:src|href)="(\/[^"?#]+)"/g)].map(value => value[1])) {
      await readFile(new URL('../vercel-public' + url, import.meta.url));
    }
    await readFile(new URL('../vercel-public/images/mango.webp', import.meta.url));
    const bundle = await readFile(new URL('./generated/server.mjs', import.meta.url), 'utf8');
    assert.ok(!/from ["'](?:cloudflare:workers|next\/headers)/.test(bundle));
  }
});
