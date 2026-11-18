# 0009. Folder structure

Status: Accepted
Date: 2026-11-03

## Context

- Better's web template lays its frontend out in layers in `flask-react-template/src/apps/frontend`, so that a backend can sit beside it in `src/apps/backend` ([0004](0004-better-frontend-conventions.md)).
- `AGENTS.md` rule 1 bans abbreviations and names `config` among them. Rule 6 keeps logic out of broad utility files. Rule 10 ships nothing without a caller.
- Hot reload needs a `.tsx` file to export only components (the lint rule `react/only-export-components`), so a context and the component that supplies its value cannot share a file.
- Each file's role should be clear from its folder and its name, for a reader who knows the template.

## Decision

```text
src/apps/frontend/
├── app.component.tsx, main.tsx, style.css, vitest.setup.ts, test helpers (test-*.ts, test-*.tsx)
├── components/      application-shell/, record-list-tab/, record-row/, ..., index.ts
├── configuration/   configuration.ts, configuration.test.ts, index.ts
├── constants/       date-format.ts, fhir.ts, routes.ts, index.ts
├── contexts/        authentication.context.ts, condition.context.ts, ..., index.ts
├── hooks/           asynchronous.hook.ts, record-search.hook.ts, ..., index.ts
├── pages/           home/, health-records/, medications/, sign-in/, ..., index.ts
├── providers/       authentication.provider.tsx, condition.provider.tsx, ..., index.ts
├── routes/          guards/ (protected-route.tsx, public-route.tsx), route-objects.tsx, index.tsx, index.test.tsx
├── services/        authentication/, condition/, medplum/, ..., index.ts
├── types/           common.ts, search-page.ts, service-response.ts, ..., index.ts
└── utilities/       count-text.ts, fhir-text.ts, ..., index.ts
```

- The frontend lives in `src/apps/frontend`. Tooling stays at the repository root with Vite's defaults: `index.html`, `vite.config.ts`, `vitest.config.ts`, `.env.local`.
- Layers: components, configuration, constants, contexts, hooks, pages, providers, routes, services, types and utilities. A folder is created with its first file; there are no empty folders.
- Contexts and providers are separate layers: `contexts/authentication.context.ts` declares the context and the hook that reads it, and `providers/authentication.provider.tsx` supplies its value.
- Pages get one folder each, holding the page, its own components and its own hook. Services get one folder per domain, such as `services/authentication/` and `services/medplum/`. Contexts and providers hold one file per domain.
- Data layers are named for the FHIR resource they read (`services/medication-request/`), and pages for what the patient sees (`pages/medications/`).
- File names carry their role: `*.page.tsx`, `*.context.ts`, `*.provider.tsx`, `*.hook.ts`, `*.service.ts`, `*.test.ts(x)`. A component is named for what it is: `sign-in-form.tsx`. Hooks are named `use…` in code and keep the `*.hook.ts` role suffix in their file name, like every other role.
- Each layer has one `index.ts`. Domain folders have none.
- `routes/route-objects.tsx` lists every route under its guard; `routes/guards/` holds the guards; `routes/index.tsx` renders the router.
- `components/` holds components of our own, added only when Base Web has no equivalent ([0002](0002-base-web-for-the-ui.md)). The application shell is `components/application-shell/`, and the layout that places it is `pages/application-layout/`, as the template keeps `components/app-shell/` and `pages/app-layout/`.
- `types/` holds only types that several layers share. A type used by one module is declared in it.
- Hooks shared across pages go in `hooks/`. A page's own hook stays in its page folder.
- `utilities/` holds small functions with no state that several pages share, one file per purpose (`fhir-text.ts` words dates and codes for the patient). A function used by one module stays in it.
- Imports between our own files are relative: `./sign-in-form`, `../../types`. There is no path alias, so `tsconfig.app.json` and `vite.config.ts` stay as Vite generates them ([0006](0006-recommended-setup-with-default-settings.md)).

## Consequences

- A backend can be added at `src/apps/backend` without moving the frontend, as in the template.
- Moving a file means updating the relative paths that point to it and from it; editors do this when a file is moved through them.
- A page that reads several resources takes each from its own context, so pages stay thin and data layers stay shared.

## Alternatives considered

- **A path alias, `@/` or the template's `frontend/`.** Not chosen: an alias needs `paths` in `tsconfig` and a resolve option in Vite, both overrides of the defaults that [0006](0006-recommended-setup-with-default-settings.md) keeps. Relative imports work with no configuration.
- **Feature folders per resource, such as `features/conditions/` with its context, provider and service.** Not chosen: each resource has only its context, provider and service, named alike (`condition.*`), and most pages read several resources each. Better's template is layered. Feature folders are reconsidered when a resource gains components or hooks that several pages share.
- **`config/` and `utils/`.** Not chosen: both are abbreviations (`AGENTS.md` rule 1). The folders are `configuration/` and `utilities/`.
- **An `integrations/medplum/` folder.** Not chosen: Medplum is the app's backend ([0001](0001-frontend-only-app-on-medplum.md)) and server-side work goes to Medplum Bots, so there is no second integration. Services are the only code that calls Medplum.
- **Hook files named `use-*.ts`.** Not chosen: every other file carries its role as a suffix, and hooks follow the template's `*.hook.ts`.
- **An `index.ts` in each domain folder.** Not chosen: one per layer keeps imports short without a barrel file in every folder.
- **A `layouts/` folder apart from `components/`.** Not chosen while the app has one layout: the template keeps its shell in `components/` and its layout in `pages/`.
