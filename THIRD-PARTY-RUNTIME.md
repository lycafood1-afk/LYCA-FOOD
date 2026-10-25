# Included local runtime dependencies

The local runtime includes complete npm package distributions so normal startup can work without a package download or a native build:

- @electric-sql/pglite 0.5.10 — Apache-2.0; embedded PostgreSQL/WebAssembly.
- TypeScript 5.9.3 — Apache-2.0; loads the existing TypeScript API routes.
- Zod 3.25.76 — MIT; existing API input validation.

Their licenses, notices and distribution files are retained under local-runtime/node_modules. Exact versions and registry integrity hashes are recorded in local-runtime/package-lock.json. Prebuilt customer/admin assets retain the dependencies from their respective source manifests and lockfiles. The original vendored UI/plugin license files are preserved.
