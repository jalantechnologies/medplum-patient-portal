# 0005. Vite as the build tool

Status: Accepted
Date: 2026-11-03

## Context

- Better's web template, [flask-react-template](https://github.com/jalantechnologies/flask-react-template), builds its frontend with Webpack 5 (`webpack.dev.js`, `webpack.prod.js`, loaders for TypeScript, styles and HTML) and runs its frontend tests with Vitest.
- Vitest runs on Vite's own transform pipeline, so the template already carries two pipelines: Webpack for the app and Vite for the tests.
- Medplum's sample apps, Foo Medical and Medplum Provider, build with Vite (`vite.config.ts`).

## Decision

Build and serve the app with [Vite](https://vite.dev/) and its React plugin, `@vitejs/plugin-react`. Tests use Vitest with the same Vite configuration.

## Consequences

- One pipeline and one configuration for the development server, the production build and the tests.
- Patterns from Medplum's sample apps carry over directly, because they use the same tool.
- Environment variables are read through `import.meta.env` and must start with `VITE_` to reach the browser.
- This differs from Better's template. Engineers used to its `webpack.*.js` files find a single `vite.config.ts` here ([0004](0004-better-frontend-conventions.md)).

## Alternatives considered

- **Webpack 5, as in Better's template.** Not chosen: it would keep a second pipeline next to Vitest's and needs more configuration to maintain.
