# Patient Portal

An open source patient platform on [Medplum](https://www.medplum.com/), built by [Better](https://btr.group/). A patient has one account and sees, in one place, what every hospital and clinic they have visited recorded about them, each record showing where it came from.

A patient signs in on a phone or a laptop and sees their own health record, manages appointments, messages their care team, follows their care plans and sees their bills. The platform runs one Medplum project, which holds every patient's account and the records from every source. A clinic can also run its own copy for its own patients.

## Status

Early development. A patient can sign in with their Medplum account, see Home with their ongoing care plans, how many sources their records come from, their next visit, their care plans with the clinic of each, and when the portal last received their records, see a summary of their health in Health profile, see their prescriptions in Medications, see their lab reports and their results in Test results, see their conditions, allergies and measurements in Health records, see which clinic sent each condition, allergy, measurement, prescription and test report, see when the portal received each record, move around the portal on a phone or a laptop, and sign out. The screens for the rest of their health record come next.

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

| Variable                          | What it holds                                                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `VITE_MEDPLUM_SERVER_ADDRESS`     | The Medplum server's address, for example `http://localhost:8103/`                                                             |
| `VITE_MEDPLUM_PROJECT_IDENTIFIER` | The identifier of the Medplum project the patients belong to. Patient accounts belong to a single project, so sign-in needs it |

Then open the address the development server prints, and sign in with a patient account.

## Patient access

Each patient may see only their own care plans, conditions, allergies, test reports, observations and prescriptions, the appointments they take part in, and the lists about them, such as the list of the sources their records came from. Observations cover every kind: Health records shows the measurements, and Test results the results in each report. Medplum enforces this with an [access policy](https://www.medplum.com/docs/access/access-policies) on the patient's project membership, not the portal: a patient can call Medplum's API directly, so what the portal's screens leave out is not hidden from them. The portal's policy is [`data/core/patient-access-policy.json`](data/core/patient-access-policy.json). It lets a patient search those resource types and do nothing else: no other resource types, and no changes. It also lets a patient read any medicine (`Medication`) in the project by its identifier, including an earlier version of it, so a prescription that points to a medicine, or to the version prescribed, shows the drug's name. A medicine describes a drug, not a patient. Patients cannot search medicines, so none can look up which medicines another patient takes. In the same way, it lets a patient read any clinic (`Organization`) by its identifier, so that each record can name the clinic it came from, and never search clinics, so that no patient can look up which clinics another patient visits. The patient's own profile comes with their sign-in, so the policy does not grant `Patient`. An appointment shared by several patients, such as a group visit, shows each of them every participant.

As a project admin in Medplum's app:

1. **Create the policy.** Open `/AccessPolicy/new/json`, paste the contents of the file and save.
2. **Make it the default for invited patients.** Open `/Project/<project identifier>/json`. In `defaultAccessPolicies`, set the `Patient` entry, or add it, to `{ "profileType": "Patient", "accessPolicy": { "reference": "AccessPolicy/<policy identifier>" } }`, and save. Patients you then [invite](https://www.medplum.com/docs/app/invite) without choosing a policy get it.
3. **Move patients invited earlier.** In `/admin/users`, open each patient, choose "Go to ProjectMembership", and on its Edit tab set the access policy to the new policy and remove every entry under "Access". Medplum adds those entries to the access policy, so an entry left in place keeps everything it granted.

A patient membership with no access policy and no "Access" entries can read and change every record in the project, so make sure none is left that way.

A project that sets `defaultPatientAccessPolicy` lets patients register themselves, and gives them that policy instead. Medplum sets it on projects created with versions 5.1.17 to 5.2.2. The portal has no self-registration yet, so remove the field on the project's JSON page. If the clinic creates patients through SCIM, which needs the field, point it at the portal's policy instead; patients can then still register themselves, with the portal's policy.

When an update to the portal changes the policy file, open the policy's JSON page (`/AccessPolicy/<policy identifier>/json`), replace its `name` and `resource` with the file's, keep its `id`, and save. Medplum needs the `id` to update the policy in place.

## Example data

`npm run load:example` loads a synthetic example patient, Eleanor Walsh, into the project named in `VITE_MEDPLUM_PROJECT_IDENTIFIER`, with her records from four sources: Oak Dermatology, Harbor Laboratory, Maple Dental and Pine Family Clinic. Each record keeps the source it came from, in `meta.source` and in an identifier from that source, and a list of her four sources lets the portal name the source of each record. The data is a FHIR transaction bundle, [`data/example/eleanor-walsh.json`](data/example/eleanor-walsh.json).

The command moves every date by the same number of days, so that the bundle's `timestamp` falls on the day of the load: her records keep their spacing, and her next visit is five days after the load. Each time keeps its clock time in US Central time, where the prototype places her sources, and takes the Central offset from UTC of its new day, so her visit stays at 10:30 AM Central with or without daylight saving time. Loading again updates the same records in place instead of copying them, and leaves her account as it is.

Medplum saves the bundle all or nothing only for a project with the `transaction-bundles` feature. Otherwise it saves each record on its own ([Medplum's batch guide](https://www.medplum.com/docs/fhir-datastore/fhir-batch-requests#batches-vs-transactions)): when it refuses one, the others stay saved and the command stops before her account. Loading again after the fix completes the rest.

Load it into a development or demo project, never into one with real patients: the steps below put a project admin's secret in `.env.local`. Before the first load, as a project admin in Medplum's app:

1. **Set up the portal's access policy** as in [Patient access](#patient-access). The command refuses to load into a project that gives invited patients no access policy, in `defaultAccessPolicies` or the older `defaultPatientAccessPolicy`, and stops when her existing account has none, since such a patient could read every record in the project.
2. **Create a client application.** Open `/admin/clients/new`, give it a name such as "Example data", and choose "Create Client".
3. **Make it a project admin**, which inviting the patient needs. In `/admin/clients`, open the new client, choose "Go to ProjectMembership", and on its Edit tab check "Admin" and choose "Update".
4. **Fill in `.env.local`:**

| Variable                    | What it holds                                                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `MEDPLUM_CLIENT_IDENTIFIER` | The client application's identifier, shown on its page                                                                                     |
| `MEDPLUM_CLIENT_SECRET`     | The client application's secret, shown on its page. Vite gives the browser only variables that start with `VITE_`, so this one stays local |
| `EXAMPLE_PATIENT_EMAIL`     | The email the example patient signs in with, one that no one else in the project uses                                                      |
| `EXAMPLE_PATIENT_PASSWORD`  | The example patient's password, at least 8 characters                                                                                      |

The command reads the same files as the development server, `.env`, `.env.local`, `.env.development` and `.env.development.local`, in [Vite's order](https://vite.dev/guide/env-and-mode#env-files), with variables already set in the shell taking precedence.

Then run `npm run load:example`, open the portal and sign in with that email and password. If a user with that email is already in the project, for example after her project membership was removed, Medplum gives her that user and keeps its password; the command says so. When you no longer need the client application, uncheck "Admin" on its membership or remove it.

## Scripts

| Command                 | What it does                                                   |
| ----------------------- | -------------------------------------------------------------- |
| `npm run serve`         | Starts the development server                                  |
| `npm run build`         | Checks types and builds for production into `dist/`            |
| `npm test`              | Runs the tests once with Vitest                                |
| `npm run preview`       | Serves the production build                                    |
| `npm run load:example`  | Loads the example patient, as in [Example data](#example-data) |
| `npm run lint`          | Lints the TypeScript and JavaScript code with oxlint           |
| `npm run lint:markdown` | Lints the Markdown files with remark                           |
| `npm run format`        | Formats every file with Prettier                               |
| `npm run format:check`  | Checks the formatting of every file without changing it        |

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
