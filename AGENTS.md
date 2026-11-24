# Project Overview

Patient Portal is an open source patient platform on [Medplum](https://www.medplum.com/): one account in which a patient sees the records of every hospital and clinic they have visited, each showing where it came from ([decision 0013](docs/decisions/0013-one-account-many-sources.md)). It is a browser app with no server of its own: Medplum is the backend. See the [product requirements](docs/product-requirements.md) for what is being built, the [architecture](docs/architecture.md) for how, and the [decision records](docs/decisions/README.md) for why.

Build the cleanest, most robust, scalable and maintainable application by current industry standards. Better's template is the default, not a blueprint: the app departs from it only for the reasons listed under [Architecture](#architecture).

This file is the single source of truth for standards in this repository, for people and for AI coding assistants alike. Its rules come from Better's [engineering handbook](https://github.com/jalantechnologies/handbook) and from the `AGENTS.md` of Better's web template, [flask-react-template](https://github.com/jalantechnologies/flask-react-template), adapted to a frontend-only app on Medplum ([decision 0004](docs/decisions/0004-better-frontend-conventions.md)). New conventions are added here as they are agreed, and apply to the whole codebase from then on.

**Stack:** TypeScript · React 18 · Vite · [Base Web](https://baseweb.design/) · Medplum's SDK (`@medplum/core`, `@medplum/react-hooks`)

**Status:** early development. The project uses Vite's recommended setup at default settings ([decision 0006](docs/decisions/0006-recommended-setup-with-default-settings.md)), on the Node.js version in `.nvmrc`. The commands are listed in the README: `serve`, `build`, `preview`, `test`, `lint`, `lint:markdown`, `format`, `format:check`, `load:example` and `deploy:demo`, each run with `npm run`.

## Code written with AI assistants

The same standards and the same review apply whoever or whatever wrote the code. Code an assistant produced is the author's code once the pull request is open: the author reads it, understands it and defends it in review.

## Medplum

- Before planning or building anything that touches Medplum, read and follow [Medplum's rules for applications](https://www.medplum.com/ai/medplum-rules.md). For a new feature or a substantial change, follow Medplum's [planning steps](https://www.medplum.com/ai/planning.md) and record each consequential choice in `docs/decisions/`.
- FHIR R4 only, typed with `@medplum/fhirtypes`. Reuse `@medplum/core` helpers. Do not invent fields, search parameters, operations or codes.
- **No FHIR strings written inline.** Resource types, codes such as statuses, search parameter names and search options come from `constants/fhir.ts`: `as const` objects checked against `@medplum/fhirtypes` with `satisfies`, so a wrong value fails the type check. TypeScript enums are off in Vite's preset (`erasableSyntaxOnly`), and Medplum's own `Operator` uses the same pattern. Searches are built as Medplum's `SearchRequest` with `Operator` and sent with `formatSearchQuery`. Tests use the same constants.
- What a patient may read or change is enforced by the Medplum project's access policy, never by filtering in the app.
- Server-side logic goes in a Medplum Bot, not in a server of our own ([decision 0001](docs/decisions/0001-frontend-only-app-on-medplum.md)).

## Architecture

The frontend follows the layers of Better's [frontend architecture](https://github.com/jalantechnologies/flask-react-template/blob/main/docs/frontend-architecture.md): routes, pages, components, contexts, providers, hooks, services, configuration, constants, types and utilities. It lives in `src/apps/frontend`, as in the template, so a backend can be added beside it in `src/apps/backend` ([decision 0009](docs/decisions/0009-folder-structure.md)). Better's template is the default. The app departs from it only when a tool's own default or preset says otherwise, when the template's way breaks something, when it breaks a rule in this file, or when the prototype says otherwise. Every departure is listed in [decision 0008](docs/decisions/0008-departures-from-the-template.md).

- **Routes** bind pages to URLs. The router is created once. `route-objects.tsx` lists every route under its guard, and the guards in `routes/guards/` redirect public and signed-in routes to the other side.
- **Pages** are thin. They compose components, read shared state from contexts and handle success and failure.
- **Components** come from Base Web, used directly ([decision 0002](docs/decisions/0002-base-web-for-the-ui.md)). Do not wrap a Base Web component in one of our own; add a component of our own only when Base Web has nothing equivalent.
- **Contexts** declare shared state and the hook that reads it (`contexts/authentication.context.ts`). Prefer React Context and hooks; do not add a Redux-like library without team approval.
- **Providers** supply a context's value, each in its own file in `providers/` (`providers/authentication.provider.tsx`), because hot reload needs a `.tsx` file to export only components.
- **Services** are the only code that calls Medplum. They wrap `MedplumClient` and return typed FHIR resources or the app's own types.
- **A service method takes one parameters object.** Each public method of a domain service takes a single typed object named for what it does, such as `ListDiagnosticReportsParameters`, declared in `types/`, as the template's backend does with its `…Params` classes; the word is written in full (rule 1). A new argument changes the type, not every caller. Inside the service, one place turns those parameters into Medplum's search filters, as the template's `_to_filter` does.
- **A service file holds only its service.** Its FHIR strings come from `constants/fhir.ts`, the types it shares with other layers from `types/`, and generic Medplum access (pages, counts, searches by identifier) from `MedplumService`. Medplum's own helpers come before one of ours, such as `tryParseReference` to read a reference.
- **Data flows service → provider → context → page**, as in the template's `AccountProvider`. A provider creates its domain's service, calls it through `useAsynchronousResult` (or `useAsynchronousResultState`, which returns the same state as one object), and holds the result, the loading state and the error; its context's hook hands them to pages (`useCarePlanContext`). Pages and their hooks never create or call a service. What a page shows while shared data loads, fails or comes back is set in [decision 0011](docs/decisions/0011-shared-data-across-pages.md).
- **Hooks** shared across pages go in `hooks/`. A page's own hook stays in its page folder.
- **Configuration** reads and validates the environment once, when the app starts.
- **Constants and types** are the shared contracts. `types/` holds only types that several layers share; a type used by one module is declared in it.
- **Utilities** are small functions with no state that several pages share, one file per purpose (`utilities/fhir-text.ts` words dates and codes for the patient). A function used by one module stays in it.
- **Folders and files.** Pages get one folder each, and services one folder per domain (`services/authentication/`). Contexts and providers hold one file per domain. Files carry their role: `home.page.tsx`, `authentication.context.ts`, `authentication.provider.tsx`, `sign-in-form.hook.ts`, `authentication.service.ts`, `sign-in-form.test.tsx`; a component is named for what it is (`sign-in-form.tsx`). Each layer has one `index.ts`, and domain folders have none. A folder is created with its first file.

## Review guidelines

### General

1. **No abbreviations or shorthand, strictly.** Every name we choose is written in full words: variables, parameters, functions, hooks, components, types, constants, files and folders, test names and configuration keys. Write `identifier`, `properties`, `parameters`, `event`, `error`, `index`, `button`, `message`, `configuration`, `environment`, `authentication`, `request` and `response`, never `id`, `props`, `params`, `e`, `err`, `i`, `btn`, `msg`, `config`, `env`, `auth`, `req` or `res`. Names defined by something we do not own keep their own spelling: FHIR fields such as `id` and `resourceType`, and the names in Medplum's SDK, React, Base Web and the browser.
2. **No comments, strictly.** Code explains itself through full names, small single-purpose functions and named intermediate values. The only exception is a comment that explains an unavoidable why: a reason the code itself cannot express. Such a comment states only the why, never what the code does or how it does it.
3. **US English (en-US) throughout.** Names, docs, commit messages, pull requests and text on screen use American spelling: `behavior`, `color`, `license`, `organization`, `initialize`, never `behaviour`, `colour`, `licence`, `organisation` or `initialise`. Pages declare `lang="en-US"`.
4. **Naming.** Idiomatic TypeScript naming. Components and types are nouns; functions and hooks are verbs (`loadConditions`, `useConditions`).
5. **Small functions.** One responsibility each. Split anything that passes about 50 lines or mixes concerns.
6. **Keep behavior with its data.** Put logic in the layer and feature that own it, not in broad utility files.
7. **No defensive noise.** Understand what can be undefined and rely on the types; validate at the boundaries.
8. **Reuse first.** Look for an existing component, service or hook before writing a new one.
9. **No swallowed errors.** A `catch` re-throws, throws a typed error in its place, or reports the error and continues for a reason the surrounding code makes obvious. Never one that hides a failure.
10. **Nothing ships without a caller.** Every new exported name is used in the same change.
11. **Imports at the top.** Never import inside a function; fix the cycle instead. Imports between our own files are relative (`./sign-in-form`, `../../types`); there is no path alias, so TypeScript and Vite stay at their defaults ([decision 0006](docs/decisions/0006-recommended-setup-with-default-settings.md)). Imports come in two groups: packages, then our own files, each sorted by path.
12. **One shape per entity.** One type per entity everywhere it is used; no near-duplicate variants named after a caller.
13. **Name what a module serves, not who calls it.** No roles or audiences in names or URLs.
14. **Name the mutation.** A function that changes something says so with a verb such as `create`, `update`, `delete` or `send`.
15. **A pull request holds only its task.** A problem found along the way that is not part of the task is not fixed in its pull request. A bug already on `main`, whether a review, a test or a live check finds it, is fixed at its cause in its own pull request from `main`, and the task builds on that fix once it is merged, never carrying it. The one exception is a documentation fix of a line or so, such as a stale sentence in the README, which may ride with the task. The review of a fix covers only that fix's diff. Check with `git diff --stat origin/main...HEAD` that every file belongs to the task.

### Frontend

16. **Design system.** Base Web is the design system. Pages compose Base Web components and choose presentation through their props (`kind`, `size`) and the theme's tokens (`scale800`, `contentSecondary`), never raw colors or pixel values. Copy the prototype's sizes: compact buttons, `HeadingMedium` for page titles.
17. **No inline styling, strictly.** No `style` objects, no `$style`, and no `overrides` that set styles, in pages or anywhere else. If a Base Web component does not look right as it is, pick the Base Web component made for that purpose, or raise it. Text meant only for screen readers uses the `visually-hidden` class in `style.css`, the one shared class, since Base Web has no component for it.
18. **Test hooks.** Tests address the UI through `data-testid`, set directly on Base Web components (or through `overrides` where Base Web does not pass it through, such as the inner `input` of `Input`), not through text or class selectors.
19. **Accessibility.** Every screen is reachable by keyboard and screen reader, and each page has a `main` landmark. Meaningful icons have an accessible name; interactive elements are real semantic elements or carry the right `role` and keyboard handling; form controls associate their label, description and error. A live region holds a short status, such as how many records are shown, never the records themselves, which a screen reader would read out in full.
20. **File names** are kebab-case (`health-profile.tsx`). Type fields are camelCase.
21. **Async code** uses `async`/`await`, never `.then()` / `.catch()` chains.
22. **Data fetching** goes through services, never inside render without a hook. Requests for a list are batched, never one per item.
23. **Times in the patient's own time zone.** The app shows every time in the time zone of the patient who reads it, never in one fixed zone such as the clinic's. Only the example data uses one zone, US Central, the one the prototype shows.
24. **Only what every supported browser has.** The app's code uses only the JavaScript that every browser Vite builds for supports: Chrome and Edge 111, Firefox 114 and Safari 16.4, and later. It copies an array and changes the copy instead of calling `toReversed`, `toSorted`, `toSpliced` or `with`, which Firefox 114 lacks. Tests run on Node.js and may use them.

## Security and privacy

- Use synthetic data only: in code, tests, fixtures, screenshots, issues and demos.
- Never log, echo or send patient data to analytics or error reporting.
- Never commit credentials or secrets. Configuration comes from environment variables.
- Call out in the pull request any change that touches sign-in, sessions, access control or patient data, and say how it stays safe.

## Testing

- Frontend behavior changes ship tests that drive the real code.
- Tests use synthetic data and Medplum's `MockClient`, or a local Medplum server.
- Tests come from FHIR's data shapes, not only from our sample records: repeating elements (several codings, several dosages), modifier elements, missing values, more records than one page, and a failure of each request, not only the first.
- A change to shared code (a hook in `hooks/`, a provider or a context) is tested, before its pull request, against every page that uses it and against the next planned page that will.

## Commits and pull requests

From Better's [pull request guidelines](https://github.com/jalantechnologies/handbook/blob/main/engineering/pr-etiquette.md):

- **A feature starts from an issue.** The issue says who is affected and what they run into, gives an example, names the requirement it delivers in the [product requirements](docs/product-requirements.md), and lists its acceptance criteria. Its pull request links it under "Why", as `Closes #12`. A fix or a maintenance change, such as a dependency update, may start from its pull request alone, whose "Why" says the same: who is affected, what they run into, and an example.
- **One logical change per pull request**, raised as one commit. One issue is one pull request.
- **Branches** are named `author/type/description`, for example `shubham/feat/sign-up`.
- **Commit messages and pull request titles** use the Conventional Commit form `type: description`, at most 50 characters, in the imperative mood: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, plus `perf`, `style`, `build`, `ci` and `revert`.
- **Pull request descriptions** fill in every section of the [template](.github/pull_request_template.md), which follows the handbook: why, what changes, data and configuration changes, screenshots and a Loom, and tests. Write for a reader with no background.
- **Assign yourself** to the pull request and add the labels that fit it.
- **Code review** reports every finding, with no limit on their number, and marks each one as new in this change or already on `main` (rule 15). A pull request gets one full review; after its fixes, the next review covers only what the fixes changed.
- **Before asking for review:** review every line as if someone else wrote it, test the change, remove debug code, and check that no abbreviation, shorthand or comment is left, other than a why-only comment.
- **Nothing is pushed to `main` directly**, setup and infrastructure included. Every change is merged through a reviewed pull request.
