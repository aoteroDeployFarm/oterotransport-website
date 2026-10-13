# oterotransport-website

Website for Otero Transport (oterotransports.com). Next.js 16, TypeScript, Tailwind CSS 4,
App Router, statically exported for Cloudflare Pages.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local development server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm run build` | Static export to `out/` |

## Content

All business facts and copy live in `src/content/site.ts`. Any value left `null` or empty
renders a visible "Needs review" marker on the site instead of invented content. Fill in
verified facts only, then set `indexable: true` to lift the `noindex` tag and the
disallow-all `robots.txt`.

There is no contact form: a static site needs an approved submission service (for example
Cloudflare Pages Functions with an email provider, or a hosted form service) before one
can be added.

## Cloudflare Pages settings

- Framework preset: Next.js (Static HTML Export)
- Build command: `npm run build`
- Build output directory: `out`
- Root directory: `/`
- Node version: read from `.node-version`
- Environment variables: none

`public/_headers` sets security and caching headers.

## Known dependency findings

`npm audit` reports 5 high-severity findings. They are one advisory counted along one chain:
`braces` <=3.0.3 ([GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm),
stack-exhaustion denial of service) via `micromatch` -> `fast-glob` ->
`@next/eslint-plugin-next` -> `eslint-config-next`.

- Scope: lint tooling only. `npm audit --omit=dev` reports 0 vulnerabilities and nothing in
  the chain ships in `out/`.
- No patched `braces` release exists (3.0.3 is the latest), so there is no compatible fix.
- Do not run `npm audit fix --force`: it downgrades `eslint-config-next` to 14.x.
- Re-check with `npm audit` when `braces` or `eslint-config-next` publishes a new release.
