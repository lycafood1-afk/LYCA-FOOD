# LYCA — Customer website and Ingredient Studio

For **two separate Vercel deployments sharing one Neon database and photo store**,
start with [VERCEL-DEPLOY.md](VERCEL-DEPLOY.md).

Use the **repository root** for both Vercel projects. Configure `LYCA_SITE_ROLE`
as `admin` on one and `customer` on the other. Root `vercel.json` handles both.

- Admin: independent email/password sign-in; product and category create/edit/delete;
  custom photos; publish/draft/archive; search and permanent deletion controls.
- Customer: published catalogue with live categories and photos, working search,
  product details, enquiries and a Back button.
- Shared Neon records and Vercel Blob photos survive redeployment.
- Customer deployment rejects administrator writes and private catalogue reads.

Local-only Windows startup and source editing instructions are in
[START-HERE.md](START-HERE.md). Local data is separate from hosted Neon/Blob.

The archive includes frontend builds and source. Root builds bundle the Node.js
API and select the correct frontend. Original Cloudflare/Vinext source is retained.

See [VALIDATION.md](VALIDATION.md) for checks and verification limits.
