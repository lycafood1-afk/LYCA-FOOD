# LYCA ingredient administration and customer sync

The current catalogue contains 108 brochure ingredients in seven families. Its defaults are bundled in the catalogue service; administrator overrides are durable records in the `ingredients` D1 table. Uploaded images use the existing R2 bucket. The pre-existing product and contact-setting tables are retained.

## Workflow

1. Open the LYCA Product Administration site with the approved owner account.
2. Choose Add ingredient, enter the name, family and group, and optionally add a description, specifications, partner and photo.
3. Save as Draft while preparing the entry. Select Published and save to make it visible in the customer catalogue. Select Archived to hide it while preserving its record.
4. Open Customer site from the admin sidebar. Its catalogue reads the same backend, checks every 10 seconds while visible, and refreshes on focus or connectivity recovery.

The latest purple/champagne customer design is hosted under `/customer/` on the administration site. Product descriptions, specifications, partner details and uploaded photographs have individual ingredient detail pages. Enquiries prefill the selected ingredient and partner.

## Security and consistency

The existing private-site audience, owner allowlist, server-side bridge and service credentials are preserved. The administration bridge key never enters customer JavaScript. API writes reject unauthorized and cross-origin requests. Records carry versions; stale or concurrent edits receive HTTP 409 rather than overwrite newer work. Drafts and archived items are filtered on the server, not just hidden in CSS.

The customer feed is read-only and uses no-store responses. The Vercel customer source includes `api/catalogue.ts`, a server-only read proxy. Configure CATALOGUE_ORIGIN and CATALOGUE_SERVICE_TOKEN in Vercel to connect that separate deployment. Never prefix the token with VITE_. The currently deployed Vercel website is not changed merely by publishing these Sites versions.

## Validation

TypeScript checks and production builds passed for the admin, catalogue service and customer application. Isolated integration checks execute the real API route and storage code against an in-memory SQLite implementation of D1 and an R2 fixture. They cover initial catalogue load, authorization, origin checks, draft visibility, publishing, duplicate entries, validation failures, version conflicts, concurrent writes, photo upload/read and archiving including seeded ingredients.

Browser QA inspected the local signed-out admin view. Full protected browser interaction is limited by the preview's lack of a signed-in owner identity; no authentication was bypassed. No test product was written into the hosted database.
