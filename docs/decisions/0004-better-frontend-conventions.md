# 0004. Follow the frontend conventions of Better's web template

Status: Accepted
Date: 2026-11-03

## Context

Better's [engineering handbook](https://github.com/jalantechnologies/handbook) says new web apps start from [flask-react-template](https://github.com/jalantechnologies/flask-react-template), and that engineers should understand the reasons behind its architecture. The template is a Flask and MongoDB backend with a React frontend.

This app has no backend of its own ([0001](0001-frontend-only-app-on-medplum.md)), so generating it from the template would bring in a backend that must then be removed. Generating it would also put the whole template on `main` without a reviewed pull request.

## Decision

This is a frontend-only repository that adopts the template's frontend conventions, set up through reviewed pull requests:

- **Architecture.** The layers of the template's [frontend architecture](https://github.com/jalantechnologies/flask-react-template/blob/main/docs/frontend-architecture.md): routes, pages, components, contexts, services, constants and types. Each feature is a page, a route, a service and a context if it needs one; its screens use Base Web components.
- **Design system rules.** The intent of the template's [frontend design system](https://github.com/jalantechnologies/flask-react-template/blob/main/docs/frontend-design-system.md): presentation is chosen through tokens and component props, never raw values, and every screen is accessible. The template builds its own components because it has no component library; this app uses Base Web's directly ([0002](0002-base-web-for-the-ui.md)).
- **Review guidelines, security and testing rules.** Those that apply to a frontend, written into [AGENTS.md](../../AGENTS.md).
- **Tooling.** The kinds of tools the template uses, at their latest releases and default settings: Prettier, Husky with lint-staged, remark for Markdown, Vitest for tests and a pinned Node.js version. TypeScript is linted with oxlint, as in Vite's recommended setup, instead of the template's ESLint ([0006](0006-recommended-setup-with-default-settings.md)).
- **Process.** Commit and pull request conventions from the handbook's [pull request guidelines](https://github.com/jalantechnologies/handbook/blob/main/engineering/pr-etiquette.md), a pull request template built from those guidelines, and `AGENTS.md` as the single source of standards, with `CLAUDE.md` pointing to it.

Where this app differs from the template:

| Template                                                    | This app                                | Why                                                     |
| ----------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------- |
| Tailwind design system                                      | Base Web components, used directly      | [0002](0002-base-web-for-the-ui.md)                     |
| Axios calling the app's own API                             | Services wrapping Medplum's SDK         | [0001](0001-frontend-only-app-on-medplum.md)            |
| ESLint 7 with Airbnb's configs, Prettier with single quotes | oxlint and Prettier at default settings | [0006](0006-recommended-setup-with-default-settings.md) |
| Webpack 5                                                   | Vite                                    | [0005](0005-vite-as-the-build-tool.md)                  |

## Consequences

- Engineers who know Better's template find the same structure and rules here.
- Rules live in `AGENTS.md`. Conventions agreed later are added there and apply to the whole codebase from then on.
- Changes to the template are not picked up automatically. Adopting one is a reviewed pull request.

## Alternatives considered

- **Generate from flask-react-template and delete the backend.** Not chosen for the reasons above.
- **Start from Vite's React template with no house conventions.** Not chosen: it would drop the structure and review rules Better's engineers share.
