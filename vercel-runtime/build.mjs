import {build} from 'esbuild';
import {cp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const backend = path.join(root, 'customer-and-backend');
export async function bundleServer(outfile = path.join(here, 'generated/server.mjs')) {
  await mkdir(path.dirname(outfile), {recursive: true});
  return build({
    absWorkingDir: root, entryPoints: [path.join(here, 'handler.mjs')], outfile,
    bundle: true, platform: 'node', format: 'esm', target: 'node22', packages: 'external',
    plugins: [{name: 'vercel-platform-adapter', setup(builder) {
      builder.onResolve({filter: /^cloudflare:workers$/}, () => ({path: path.join(here, 'environment.mjs')}));
      builder.onResolve({filter: /^@\//}, ({path: specifier}) => {
        const relative = specifier.slice(2);
        if (relative === 'app/chatgpt-auth') return {path: path.join(here, 'identity.mjs')};
        if (relative === 'app/api/media/[key]/route') return {path: path.join(here, 'media.mjs')};
        return {path: path.join(backend, relative + (path.extname(relative) ? '' : '.ts'))};
      });
      builder.onResolve({filter: /^@neondatabase\/serverless$/}, args =>
        args.importer.endsWith(path.join('db', 'postgres.ts')) ? {path: path.join(here, 'database.mjs')} : undefined);
    }}],
  });
}
export async function buildDeployment(role) {
  if (!['admin', 'customer'].includes(role)) throw new Error('Set LYCA_SITE_ROLE=admin or LYCA_SITE_ROLE=customer before building. See VERCEL-DEPLOY.md.');
  const output = path.join(root, 'vercel-public');
  await rm(output, {recursive: true, force: true});
  await mkdir(output, {recursive: true});
  // Keep the verified, prebuilt design. Ordinary Vercel builds do not install
  // either of the preserved Cloudflare projects or require native Vite bindings.
  await cp(path.join(backend, 'public'), output, {recursive: true});
  if (role === 'admin') {
    const admin = path.join(root, 'local-runtime/public/admin');
    await cp(admin, path.join(output, 'admin-assets'), {recursive: true});
    let html = await readFile(path.join(admin, 'index.html'), 'utf8');
    html = html.replace('LYCA Ingredient Studio — Local', 'LYCA Ingredient Studio');
    await writeFile(path.join(output, 'index.html'), html);
  } else {
    await cp(path.join(backend, 'public/customer/index.html'), path.join(output, 'index.html'));
  }
  await writeFile(path.join(output, '404.html'), '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Not found — LYCA</title><h1>Page not found</h1><a href="/">Back to home</a></html>');
  await bundleServer();
  console.log(`LYCA ${role} deployment built. Configure Neon and the shared Blob store in Vercel.`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await buildDeployment(process.env.LYCA_SITE_ROLE); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
