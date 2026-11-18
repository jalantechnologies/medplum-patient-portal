# 0002. Base Web for the user interface

Status: Accepted
Date: 2026-11-03

## Context

The app needs a component library for its screens.

- Medplum's own React components, `@medplum/react`, are built on Mantine 8: the package requires `@mantine/core`, `@mantine/hooks`, `@mantine/notifications` and `@mantine/spotlight`.
- Medplum's data hooks, `@medplum/react-hooks`, have no UI and work with any component library.
- Better's web template uses its own Tailwind-based design system.

The [design prototype](https://patientportal.jjalan.chatgpt.site/) is built with [Base Web](https://baseweb.design/), Uber's React component library. Its latest release is `baseui` 18.2.0, which uses Styletron for styling.

## Decision

The screens are built with Base Web. Data and sign-in come from `@medplum/core` and `@medplum/react-hooks`; `@medplum/react` is not used.

Pages use Base Web's components directly, with no wrapper layer of our own. Base Web is a complete component library with its own theme tokens, and the prototype uses it directly; a wrapper would only repeat it.

## Consequences

- Medplum's ready-made FHIR components (forms, search tables, resource views) cannot be reused. The app builds its own on Base Web, using Medplum's components and sample apps as references for data flows.
- The app depends on Styletron, which Base Web requires.
- Base Web limits the React version ([0003](0003-react-18.md)).
- The look stays consistent through Base Web's theme and the prototype's sizes, not through a layer of our own. Changing the component library later would touch every page.

## Alternatives considered

- **Mantine with `@medplum/react`.** It would reuse more of Medplum's UI. Not chosen: the prototype's look and sizes are Base Web's, and matching them in Mantine would mean restyling every component.
- **Better's Tailwind design system from flask-react-template.** Not chosen for the same reason. Its rule that pages choose presentation through tokens, not raw values, is still followed, with Base Web's tokens ([0004](0004-better-frontend-conventions.md)).
