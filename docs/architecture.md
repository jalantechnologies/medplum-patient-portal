# Architecture

How the Patient Portal is built. What it does is in the [product requirements](product-requirements.md), and the reasons behind each choice are in the [decision records](decisions/README.md). The standards every change follows are in [AGENTS.md](../AGENTS.md).

## Overview

```text
Patient's browser
  Patient Portal: static files (React, Base Web, Medplum's SDK)
        |
        |  FHIR R4 over HTTPS, signed in as the patient
        v
Medplum project, run by the platform
  each patient's account and records, from every source
  access policies that keep each patient to their own records
  Bots for work that runs on a server
        ^
        |  each source's FHIR API
        |
Hospitals, clinics and laboratories
```

- **The portal is a browser app with no server of its own.** It talks to Medplum directly through `@medplum/core` and `@medplum/react-hooks` ([0001](decisions/0001-frontend-only-app-on-medplum.md)).
- **One Medplum project holds every patient's account and records.** A patient signs up once and sees records from every source in one place ([0013](decisions/0013-one-account-many-sources.md)).
- **Medplum enforces who sees what.** Each patient's access policy limits them to their own records. The app never hides another patient's data by filtering ([0010](decisions/0010-patient-access-policy.md)).
- **Work that runs on a server is a Medplum Bot**, such as fetching a patient's records from a hospital.

## Records and their sources

Every record keeps where it came from, as [FHIR R4](https://hl7.org/fhir/R4/resource.html#Meta) describes:

- `meta.source` holds the address of the source's system.
- An `identifier` holds the record's identifier at the source, so that loading the same record again updates it instead of copying it.
- Each source is an `Organization`, and each patient has a `List` of their sources, which every page uses to name a record's source ([0015](decisions/0015-naming-each-record-source.md)).

Records come from these sources:

1. **Synthetic clinics**, loaded by `npm run load:example` for development and demos.
2. **Hospitals the patient names.** The patient signs in at the hospital through the [SMART App Launch](https://hl7.org/fhir/smart-app-launch/) standalone patient launch, and a Bot fetches their [US Core](https://hl7.org/fhir/us/core/) records and refreshes them. Endpoints come from the vendors' published lists ([Epic](https://open.epic.com/MyApps/Endpoints), [ONC Lantern](https://lantern.healthit.gov/)).
3. **Records the patient does not know about**, found through a national network with identity proofing ([TEFCA Individual Access Services](https://open.epic.com/Home/Interoperate/TEFCA/IAS)).
4. **Clinics on Medplum**, through their FHIR API, like any other source. A patient's account stays on the platform, since Medplum keeps a patient's sign-in inside one project ([project and server scoped users](https://www.medplum.com/docs/user-management/project-vs-server-scoped-users)).

The patient APIs that the law requires let a patient read records. Booking and messages work only where a clinic's own system allows them.

## Frontend

- **User interface:** [Base Web](https://baseweb.design/) components and theme, used directly, at the prototype's sizes ([0002](decisions/0002-base-web-for-the-ui.md)).
- **Stack:** TypeScript in strict mode, React 18.3 ([0003](decisions/0003-react-18.md)), React Router, Vite ([0005](decisions/0005-vite-as-the-build-tool.md)), and Medplum's SDK.
- **Structure:** the frontend layers of Better's web template, in `src/apps/frontend`: routes, pages, components, contexts, providers, hooks, services, configuration, constants, types and utilities ([0004](decisions/0004-better-frontend-conventions.md), [0009](decisions/0009-folder-structure.md)). Data flows from a service to a provider, then through a context to a page, as [AGENTS.md](../AGENTS.md) describes, and shared data behaves across pages as [0011](decisions/0011-shared-data-across-pages.md) sets out.
- **Sign-in:** Medplum's email and password sign-in, embedded in the app ([0007](decisions/0007-authentication.md)).

## Configuration

Two environment variables, read and checked once when the app starts:

| Variable                          | What it holds                               |
| --------------------------------- | ------------------------------------------- |
| `VITE_MEDPLUM_SERVER_ADDRESS`     | The Medplum server's address                |
| `VITE_MEDPLUM_PROJECT_IDENTIFIER` | The Medplum project that patients belong to |

## Hosting

The demo is the portal's static files on Cloudflare Workers, with a Medplum project kept for the demo as its backend, holding synthetic patients only ([0016](decisions/0016-hosting-the-demo.md)). Each page address serves the app, which routes in the browser. A maintainer deploys it as the README's "Deploying the demo" section describes.

## Quality checks

Every tool runs at its default or recommended settings, apart from the few exceptions [0006](decisions/0006-recommended-setup-with-default-settings.md) lists:

- oxlint for TypeScript, Prettier for formatting, and remark for Markdown.
- Husky and lint-staged check every commit, and a pre-push hook refuses pushes to `main`.
- Vitest with Testing Library and Medplum's `MockClient` for tests, and a local Medplum server for checks against a real server.
