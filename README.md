# Patient Portal

An open source patient platform on [Medplum](https://www.medplum.com/), built by [Better](https://btr.group/). A patient has one account and sees, in one place, what every hospital and clinic they have visited recorded about them, each record showing where it came from.

A patient signs in on a phone or a laptop and sees their own health record, manages appointments, messages their care team, follows their care plans and sees their bills. The platform runs one Medplum project, which holds every patient's account and the records from every source. A clinic can also run its own copy for its own patients.

## Status

Early development. A person can create their own account where the portal and its Medplum project allow it ([Patient sign-up](#patient-sign-up)). A patient can sign in with their Medplum account, see Home with their ongoing care plans, how many sources their records come from, their next visit, their care plans with the clinic of each, and when the portal last received their records, see a summary of their health in Health profile, see their prescriptions in Medications, see their lab reports and their results in Test results, see their conditions, allergies, procedures and measurements in Health records, see which clinic sent each condition, allergy, procedure, measurement, prescription and test report, see when the portal received each record, move around the portal on a phone or a laptop, and sign out. The screens for the rest of their health record come next.

## Prerequisites

- Node.js 26.13.0, the version in `.nvmrc`. With nvm, run `nvm use` in the project folder.
- A Medplum server with a project and a patient account in it, set up as in [Patient access](#patient-access). For local development, [run Medplum locally](https://www.medplum.com/docs/contributing/run-the-stack) and load the example patient as in [Example data](#example-data).

## Getting started

```sh
npm install
cp .env.example .env.local
npm run serve
```

Fill in `.env.local` before starting:

| Variable                          | What it holds                                                                                                                                                                                                   |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_MEDPLUM_SERVER_ADDRESS`     | The Medplum server's address, for example `http://localhost:8103/`                                                                                                                                              |
| `VITE_MEDPLUM_PROJECT_IDENTIFIER` | The identifier of the Medplum project the patients belong to. Patient accounts belong to a single project, so sign-in needs it                                                                                  |
| `VITE_SIGN_UP_ENABLED`            | `true` shows "Create your account" on the sign-in page, so a person can create their own account. Leave it `false`, the default, until the Medplum project allows it, as in [Patient sign-up](#patient-sign-up) |

Then open the address the development server prints, and sign in with a patient account.

## Patient access

Each patient may see only their own care plans, conditions, allergies, procedures, test reports, observations and prescriptions, the appointments they take part in, and the lists about them, such as the list of the sources their records came from. Observations cover every kind: Health records shows the measurements, and Test results the results in each report. Medplum enforces this with an [access policy](https://www.medplum.com/docs/access/access-policies) on the patient's project membership, not the portal: a patient can call Medplum's API directly, so what the portal's screens leave out is not hidden from them. The portal's policy is [`data/core/patient-access-policy.json`](data/core/patient-access-policy.json). It lets a patient search those resource types and do nothing else: no other resource types, and no changes. It also lets a patient read any medicine (`Medication`) in the project by its identifier, including an earlier version of it, so a prescription that points to a medicine, or to the version prescribed, shows the drug's name. A medicine describes a drug, not a patient. Patients cannot search medicines, so none can look up which medicines another patient takes. In the same way, it lets a patient read any clinic (`Organization`) by its identifier, so that each record can name the clinic it came from, and never search clinics, so that no patient can look up which clinics another patient visits. The patient's own profile comes with their sign-in, so the policy does not grant `Patient`. An appointment shared by several patients, such as a group visit, shows each of them every participant.

As a project admin in Medplum's app:

1. **Create the policy.** Open `/AccessPolicy/new/json`, paste the contents of the file and save.
2. **Make it the default for invited patients.** Open `/Project/<project identifier>/json`. In `defaultAccessPolicies`, set the `Patient` entry, or add it, to `{ "profileType": "Patient", "accessPolicy": { "reference": "AccessPolicy/<policy identifier>" } }`, and save. Patients you then [invite](https://www.medplum.com/docs/app/invite) without choosing a policy get it.
3. **Move patients invited earlier.** In `/admin/users`, open each patient, choose "Go to ProjectMembership", and on its Edit tab set the access policy to the new policy and remove every entry under "Access". Medplum adds those entries to the access policy, so an entry left in place keeps everything it granted.

A patient membership with no access policy and no "Access" entries can read and change every record in the project, so make sure none is left that way.

Medplum 5.2.18 and later let patients register themselves only when the project turns on `openPatientRegistration` ([Patient sign-up](#patient-sign-up)), and give them the `Patient` entry of `defaultAccessPolicies`. The older field `defaultPatientAccessPolicy` is used only when that entry is missing. Earlier releases let patients register themselves whenever the project sets `defaultPatientAccessPolicy`, and give them that policy instead; Medplum sets it on projects created with versions 5.1.17 to 5.2.2. On a release before 5.2.18, remove the field on the project's JSON page, or point it at the portal's policy if the clinic creates patients through SCIM, which needs the field there.

When an update to the portal changes the policy file, open the policy's JSON page (`/AccessPolicy/<policy identifier>/json`), replace its `name` and `resource` with the file's, keep its `id`, and save. Medplum needs the `id` to update the policy in place.

## Patient sign-up

A person can create their own account from the sign-in page, with their name, their email and a password. Medplum creates the account and the person's own patient record, and gives them the `Patient` entry of `defaultAccessPolicies`, the portal's policy from [Patient access](#patient-access). They then land on Home, signed in. Sign-up needs Medplum 5.2.18 or later. As a project admin in Medplum's app:

1. **Set up the portal's access policy** as in [Patient access](#patient-access), steps 1 and 2.
2. **Turn on open registration.** Open `/admin/settings`, add a setting named `openPatientRegistration` with the boolean value `true`, and save ([Medplum's guide](https://www.medplum.com/docs/user-management/open-patient-registration)).
3. **Turn on sign-up in the portal** with `VITE_SIGN_UP_ENABLED=true`.

Anyone who knows the project's identifier can then create an account, through the portal or through Medplum's API. Medplum accepts at most 5 new accounts a minute from one address ([rate limits](https://www.medplum.com/docs/rate-limits)), and does not ask a new patient to confirm their email ([decision 0007](docs/decisions/0007-authentication.md)).

A Medplum server that requires reCAPTCHA, such as Medplum's hosted service, refuses to create an account without a reCAPTCHA token, which the portal does not send yet, so leave sign-up off there. Sign-up works on a server without it, such as a local one ([server configuration](https://www.medplum.com/docs/self-hosting/server-config)).

## Example data

`npm run load:example` loads a synthetic example patient, Eleanor Walsh, into the project named in `VITE_MEDPLUM_PROJECT_IDENTIFIER`, with her records from four sources: Oak Dermatology, Harbor Laboratory, Maple Dental and Pine Family Clinic. Each record keeps the source it came from, in `meta.source` and in an identifier from that source, and a list of her four sources lets the portal name the source of each record. The data is a FHIR transaction bundle, [`data/example/eleanor-walsh.json`](data/example/eleanor-walsh.json).

The command moves every date by the same number of days, so that the bundle's `timestamp` falls on the day of the load: her records keep their spacing, and her next visit is five days after the load. Each time keeps its clock time in US Central time, where the prototype places her sources, and takes the Central offset from UTC of its new day, so her visit stays at 10:30 AM Central with or without daylight saving time. Loading again updates the same records in place instead of copying them.

Medplum saves the bundle all or nothing only for a project with the `transaction-bundles` feature. Otherwise it saves each record on its own ([Medplum's batch guide](https://www.medplum.com/docs/fhir-datastore/fhir-batch-requests#batches-vs-transactions)): when it refuses one, the others stay saved and the command stops before her account. Loading again after the fix completes the rest.

Load it into a development or demo project, never into one with real patients: the steps below put a project admin's secret in `.env.local`. Before the first load, as a project admin in Medplum's app:

1. **Set up the portal's access policy** as in [Patient access](#patient-access). The command refuses to load into a project that gives invited patients no access policy, in `defaultAccessPolicies` or the older `defaultPatientAccessPolicy`, and stops when her existing account has none, since such a patient could read every record in the project.
2. **Create a client application.** Open `/admin/clients/new`, give it a name such as "Example data", and choose "Create Client".
3. **Make it a project admin**, which inviting the patient and setting her password need. In `/admin/clients`, open the new client, choose "Go to ProjectMembership", and on its Edit tab check "Admin" and choose "Update".
4. **Fill in `.env.local`:**

| Variable                    | What it holds                                                                                                                                                                                                                           |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MEDPLUM_CLIENT_IDENTIFIER` | The client application's identifier, shown on its page                                                                                                                                                                                  |
| `MEDPLUM_CLIENT_SECRET`     | The client application's secret, shown on its page. Vite gives the browser only variables that start with `VITE_`, so this one stays local                                                                                              |
| `EXAMPLE_PATIENT_EMAIL`     | The email the example patient signs in with, one that no one else in the project uses, at a domain where no one receives mail, such as `example.com`: Medplum emails it each time the command turns off her multi-factor authentication |
| `EXAMPLE_PATIENT_PASSWORD`  | The example patient's password, at least 8 characters and not one found in a data breach, which Medplum refuses                                                                                                                         |

The command reads the same files as the development server, `.env`, `.env.local`, `.env.development` and `.env.development.local`, in [Vite's order](https://vite.dev/guide/env-and-mode#env-files), with variables already set in the shell taking precedence. With `-- --mode demo` it reads `.env.demo` and `.env.demo.local` in place of the two development files, as in [Deploying the demo](#deploying-the-demo).

Then run `npm run load:example`, open the portal and sign in with that email and password. On every load, the first one included, the command turns off any multi-factor authentication on her account and sets her password to `EXAMPLE_PATIENT_PASSWORD`, which undoes either change by a visitor signed in as her. If a user with that email is already in the project, for example after her project membership was removed, Medplum gives her that user. If her account's user has another email, for example after `EXAMPLE_PATIENT_EMAIL` changed, the command stops before changing her sign-in: set the variable back, or remove her project membership so that the next load invites her again. When you no longer need the client application, uncheck "Admin" on its membership or remove it.

## Deploying the demo

The demo is the portal built with the demo's settings and served by [Cloudflare Workers](https://developers.cloudflare.com/workers/static-assets/), with a Medplum project kept for the demo as its backend, holding synthetic patients only ([decision 0016](docs/decisions/0016-hosting-the-demo.md)). `wrangler.jsonc` names the Worker and serves the app at every page address.

1. **Set up the demo project** as in [Patient access](#patient-access) and [Example data](#example-data).
2. **Put the demo's settings in `.env.demo.local`**, which git ignores. Set every variable that `.env.local` sets, since one left out falls back to `.env.local`: the address of the demo's Medplum server as `VITE_MEDPLUM_SERVER_ADDRESS` (`https://api.medplum.com/` for Medplum's hosted service), the demo project's identifier, its client application, and the demo patient's email and password.
3. **Sign in to Cloudflare once**, with the account that hosts the demo: `npx wrangler login`.
4. **Build with the demo's settings and deploy:** `npm run deploy:demo`. It runs `npm run build -- --mode demo`, then `wrangler deploy`, so the demo never gets a build made with other settings. `npx wrangler deploy` on its own uploads whatever `dist/` holds.

5. **Load the example data into the demo**, or load it again to set the demo patient's password back and turn off any multi-factor authentication: `npm run load:example -- --mode demo`.

Medplum's hosted service answers requests from any site. A Medplum server you run yourself answers the portal only if its [`allowedOrigins`](https://www.medplum.com/docs/self-hosting/server-config) lists the portal's address.

## Scripts

| Command                 | What it does                                                                                          |
| ----------------------- | ----------------------------------------------------------------------------------------------------- |
| `npm run serve`         | Starts the development server                                                                         |
| `npm run build`         | Checks types and builds for production into `dist/`                                                   |
| `npm test`              | Runs the tests once with Vitest                                                                       |
| `npm run preview`       | Serves the production build                                                                           |
| `npm run load:example`  | Loads the example patient, as in [Example data](#example-data)                                        |
| `npm run deploy:demo`   | Builds with the demo's settings and deploys the demo, as in [Deploying the demo](#deploying-the-demo) |
| `npm run lint`          | Lints the TypeScript and JavaScript code with oxlint                                                  |
| `npm run lint:markdown` | Lints the Markdown files with remark                                                                  |
| `npm run format`        | Formats every file with Prettier                                                                      |
| `npm run format:check`  | Checks the formatting of every file without changing it                                               |

## Documentation

- [Product requirements](docs/product-requirements.md): what the portal does, for whom, and how each part is accepted.
- [Architecture](docs/architecture.md): how it is built.
- [Decision records](docs/decisions/README.md): why it is built this way.
- [AGENTS.md](AGENTS.md): the standards every change follows, for people and AI coding assistants alike.

## Contributing

A feature starts from an issue that names the requirement it delivers. Every change goes through a reviewed pull request; nothing is pushed to `main` directly.

- A pre-commit hook checks the formatting, the code lint and the Markdown lint of the staged files. It reports problems and never changes the files.
- A pre-push hook refuses any push to `main`.
- Every pull request fills in the [pull request template](.github/pull_request_template.md).

## Data

Use synthetic data only: in code, tests, screenshots, issues and demos. Never put real patient data in this repository or anything linked from it.

## License

[Apache License 2.0](LICENSE), the license [Medplum](https://github.com/medplum/medplum) uses.
