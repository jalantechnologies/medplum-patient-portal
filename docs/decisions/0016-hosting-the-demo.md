# 0016. Hosting the demo

Status: Accepted
Date: 2026-11-18

## Context

- A clinic, a developer or a reviewer who wants to see the portal, and anyone checking a change after it merges, needs a link they can open. Today the portal runs only on a computer that also runs Medplum.
- The portal is static files: `npm run build` writes `dist/`, and the patient's browser talks to Medplum directly ([0001](0001-frontend-only-app-on-medplum.md)). A patient's account and records are kept in Medplum, so a demo needs both online: the portal, and a Medplum project that holds the demo patients.
- The app routes in the browser, so every page address must serve `index.html`. Otherwise refreshing `/medications` gives the host's "not found" page.
- Medplum answers a browser only from its own app's address, from the addresses in `allowedOrigins`, or from every address when that is `*` (`packages/server/src/cors.ts`). Medplum's hosted service, `api.medplum.com`, runs v5.2.17 and answers requests from other sites' addresses, as a preflight request showed on 2026-11-18.
- Medplum's hosted service has a free plan "for prototyping and learning" ([pricing](https://www.medplum.com/pricing)). It does not offer atomic transaction bundles ([Medplum's rules](https://www.medplum.com/ai/medplum-rules.md)). Records of real patients need a plan with a business associate agreement under HIPAA.
- A signed-in user can change their own password (`/auth/changepassword`), so a visitor signed in as a shared demo patient could lock everyone else out. A project admin can set the password of a user in the project (`POST /admin/projects/setpassword`), and Medplum then refuses a password found in a data breach (`packages/server/src/auth/setpassword.ts`). It does not check a password given when a patient is invited.
- A signed-in user can also turn on multi-factor authentication with an authenticator app (`/auth/mfa/enroll`), which every project allows, so the same visitor could make every later sign-in ask for a code from their device. A project admin can turn it off for a member of the project (`POST /admin/projects/{project}/members/{membership}/mfa/reset`), and Medplum then emails the member that it did.

## Decision

1. **Cloudflare Workers serves the portal** as static assets from `dist/`. `wrangler.jsonc` sets `not_found_handling` to `single-page-application`, so every page address serves the app ([single-page applications](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/)). Requests to static assets are free and unlimited ([pricing](https://developers.cloudflare.com/workers/platform/pricing/)).
2. **`public/_headers` adds three headers to every response** ([custom headers](https://developers.cloudflare.com/workers/static-assets/headers/)):
   - `Content-Security-Policy: frame-ancestors 'none'`, so no other site can show the sign-in page inside its own;
   - `X-Content-Type-Options: nosniff`;
   - `Referrer-Policy: strict-origin-when-cross-origin`.
3. **The demo's backend is a Medplum project kept for the demo**, holding synthetic patients only. Which Medplum server runs it, Medplum's hosted service or one of our own, is chosen before the demo's link is published.
4. **Loading the example data again restores the demo patient's sign-in.** On every load, the first one included, `npm run load:example` turns off any multi-factor authentication on the patient's account, then sets her password to `EXAMPLE_PATIENT_PASSWORD` with the admin call, never at the invitation. A maintainer undoes a visitor's change by loading again, and a password Medplum refuses stops the first load, not a later one. Each reset emails the patient's address, so `EXAMPLE_PATIENT_EMAIL` is at a domain where no one receives mail, such as `example.com`.
5. **A maintainer deploys from their own computer** with `npm run deploy:demo`, which builds with `npm run build -- --mode demo` and then runs `wrangler deploy`, so the demo never gets a build made with other settings. The demo's settings are kept in `.env.demo.local`, which git ignores. `npm run load:example -- --mode demo` reads the same file.

## Consequences

- Whoever has the demo's link and the demo patient's sign-in can try the portal without an account of their own.
- Real patients need another backend: either Medplum's hosted service on a plan with a business associate agreement, or a Medplum server the platform runs under its own agreement. That choice is recorded before the first real patient signs up.
- A merged change reaches the demo only when a maintainer deploys it. Deploying on every merge comes with continuous integration.
- The example data moves its dates to the day it is loaded, so the demo patient's next visit passes five days after a load until the data is loaded again.
- Medplum's hosted service saves each record of the example data on its own. If it refuses one record, the others stay saved, and loading again completes the rest, as the README describes.
- Wrangler keeps local state in `.wrangler/`, which git ignores ([0006](0006-recommended-setup-with-default-settings.md)).

## Alternatives considered

- **Wrangler's `build.command`, so that `npx wrangler deploy` builds by itself.** Wrangler loads `.env` and `.env.local` into the environment of every command it runs, and Vite gives variables already in the environment precedence over `.env.demo.local`, so the demo would be built with the development server's address and project.
- **Cloudflare Pages.** It works without a file in the repository, but Cloudflare advises new projects to use Workers ([Vite guide](https://developers.cloudflare.com/pages/framework-guides/deploy-a-vite3-project/)).
- **Netlify.** On its free plan, every site is paused when the month's credits run out ([how credits work](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/)).
- **Vercel.** Its Hobby plan is for personal or non-commercial use only ([terms](https://vercel.com/legal/terms)).
- **GitHub Pages.** It cannot serve the app at every page address, and it is not meant as free hosting for a business ([limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)).
