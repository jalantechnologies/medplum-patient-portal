# 0001. A frontend-only app, with Medplum as the backend

Status: Accepted
Date: 2026-11-03

## Context

A patient portal needs a store for health data, patient sign-in, rules for who may see what, and some logic that runs on a server. Medplum provides all four:

- a FHIR R4 API that holds patients' records
- [authentication](https://www.medplum.com/docs/auth), including a login a custom app can embed
- [access policies](https://www.medplum.com/docs/access/access-policies) that limit each patient to their own record
- [Bots](https://www.medplum.com/docs/bots) for server-side logic

Medplum's TypeScript SDK, `@medplum/core`, and its React hooks, `@medplum/react-hooks`, let a browser app use all of this directly.

Better's web template, [flask-react-template](https://github.com/jalantechnologies/flask-react-template), pairs a React frontend with a Flask backend and MongoDB. Here, Medplum already plays the backend's role.

## Decision

The portal is a browser single-page app that talks to Medplum directly through `@medplum/core` and `@medplum/react-hooks`. It has no backend of its own.

- What a patient may read or change is enforced by the Medplum project's access policy, not by filtering in the app, as [Medplum's rules](https://www.medplum.com/ai/medplum-rules.md) require.
- Logic that must run on a server is a Medplum Bot.
- Adding a service of our own needs a new decision record that explains why a Bot is not enough.
- The app is configured with the Medplum server's address and the project patients belong to, through environment variables.

## Consequences

- There is no server of ours to host, secure or keep running. The portal is deployed as static files that point at one Medplum project ([0013](0013-one-account-many-sources.md)).
- Patient data stays in Medplum. The app keeps none of its own.
- Correct access depends on the project's access policy, which is set up and tested on its own ([0010](0010-patient-access-policy.md)).
- Anything Medplum cannot do through its API, access policies or Bots needs a new decision before it is built.

## Alternatives considered

- **Generate the repo from flask-react-template and keep its Flask backend between the app and Medplum.** Not chosen: it would duplicate Medplum's API and sign-in, and add a server that holds patient data and must be secured and hosted. The template's frontend conventions are adopted without its backend ([0004](0004-better-frontend-conventions.md)).
- **Fork Foo Medical, Medplum's sample patient portal.** Not chosen: it is a sample built for learning, and its screens are built with Mantine, while this project uses Base Web ([0002](0002-base-web-for-the-ui.md)). Its data flows remain a useful reference.
