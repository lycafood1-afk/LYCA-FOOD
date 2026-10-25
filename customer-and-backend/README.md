# LYCA Food Ingredients

Next.js App Router conventions with React, TypeScript, Tailwind, GSAP/ScrollTrigger, Motion, Lenis and a lazy-loaded Three.js ingredient showcase. The managed hosting build uses Vinext to run the Next.js application on Cloudflare Workers.

## Website

- Home, catalogue, individual ingredient pages, company profile, contact, privacy, cookies, terms, credits and custom 404.
- 94 catalogue entries across eight categories. Product photography is representative stock, not LYCA stock photography; see `IMAGE-SOURCES.json` and `/credits`.
- Neon PostgreSQL stores ingredients, product overrides and contact settings; uploaded images remain in R2. PostgreSQL was activated and verified on 23 October 2026. See `POSTGRESQL.md` for migration details and rollback constraints. D1 is retained as a migration backup.
- EmailJS is configured in Administration → Contact settings. Required public configuration: service ID, template ID, public key. Configure the recipient as mohamed@lycafoods.com and allow the final domain in EmailJS. Template variables: from_name, reply_to, company, country, phone, product, message, consent. No live email is claimed until a real submission succeeds.
- WhatsApp and direct telephone/email links work without EmailJS.
- Optional Google Maps embeds are blocked until consent. No analytics/advertising trackers are installed.

## Administration

A separately hosted admin frontend securely proxies authorized requests to this catalogue. Server-side `ADMIN_EMAIL` allowlists the owner account. `ADMIN_BRIDGE_KEY` authorizes only the separate admin server; it must never enter browser code. The admin server also needs the catalogue origin and the platform service credential while the catalogue is private. Runtime values are managed in hosting, never in committed source.

## Product specifications and launch review

Confirm legal entity/address information, the policy wording and actual privacy/retention practices before public launch. Add only supported product specifications, certifications and claims. An approved response-time commitment may be entered in Contact settings; none is invented by default. Test EmailJS delivery to the intended mailbox after configuring it. Real-device load speed and visual mobile QA should be checked on the final domain before public launch; a sub-three-second result is a target, not a verified guarantee.

## Development

Use the pinned package manager from `package.json`. Run the managed dependency installer, then the project build script. PostgreSQL migrations are in `postgres/migrations/`. The historical D1 migration files in `drizzle/` are preserved for rollback; they are not PostgreSQL migrations. Keep application API writes behind server-side authorization. Do not expose storage or bridge credentials. The provided `.env.example` documents required key names only.

## Customer website source

`customer-site/` is imported from the uploaded `LYCA-Dark-Glass-Website(1)(1).zip`. Its purple design, assets, animation system, partner cards and enquiry CTA are preserved. The existing live catalogue integration adds PostgreSQL-backed browsing, ingredient details and R2 photo references. `npm run build` builds this customer app before the existing Worker backend; the child dependency lock is installed automatically when missing or changed.

The customer application is served at the main site root, including direct reloads of `/products`, `/ingredients/:id` and `/enquiry`. Its read-only `/api/catalogue` endpoint uses the same PostgreSQL repository as the separate administration site. The administration site links to this main customer origin, and its old `/customer/` preview URLs redirect here. API write authorization, database secrets and private-site audience are preserved. `/admin` redirects to the dedicated administration site and `/contact` redirects to `/enquiry`.
