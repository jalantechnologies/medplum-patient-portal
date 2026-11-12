# Patient Portal

An open source patient portal for clinics that run on [Medplum](https://www.medplum.com/), built by [Better](https://btr.group/).

A patient signs in on a phone or a laptop and sees their own health record, manages appointments, messages their care team, follows their care plans and sees their bills. A clinic deploys it against its own Medplum project.

## Status

Early development. A patient can sign in with their Medplum account, see Home with their ongoing care plans and their next visit, see a summary of their health in Health profile, see their prescriptions in Medications, see their lab reports and their results in Test results, see their conditions, allergies and measurements in Health records, move around the portal on a phone or a laptop, and sign out. The screens for the rest of their health record come next.

## Prerequisites

- Node.js 26.13.0, the version in `.nvmrc`. With nvm, run `nvm use` in the project folder.
- A Medplum server with a project and a patient account in it, set up as in [Patient access](#patient-access). For local development, [run Medplum locally](https://www.medplum.com/docs/contributing/run-the-stack).

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

Each patient may see only their own care plans, conditions, allergies, test reports, observations and prescriptions, and the appointments they take part in. Observations cover every kind: Health records shows the measurements, and Test results the results in each report. Medplum enforces this with an [access policy](https://www.medplum.com/docs/access/access-policies) on the patient's project membership, not the portal: a patient can call Medplum's API directly, so what the portal's screens leave out is not hidden from them. The portal's policy is [`data/core/patient-access-policy.json`](data/core/patient-access-policy.json). It lets a patient search those resource types and do nothing else: no other resource types, and no changes. The patient's own profile comes with their sign-in, so the policy does not grant `Patient`. An appointment shared by several patients, such as a group visit, shows each of them every participant.

As a project admin in Medplum's app:

1. **Create the policy.** Open `/AccessPolicy/new/json`, paste the contents of the file and save.
2. **Make it the default for invited patients.** Open `/Project/<project identifier>/json`. In `defaultAccessPolicies`, set the `Patient` entry, or add it, to `{ "profileType": "Patient", "accessPolicy": { "reference": "AccessPolicy/<policy identifier>" } }`, and save. Patients you then [invite](https://www.medplum.com/docs/app/invite) without choosing a policy get it.
3. **Move patients invited earlier.** In `/admin/users`, open each patient, choose "Go to ProjectMembership", and on its Edit tab set the access policy to the new policy and remove every entry under "Access". Medplum adds those entries to the access policy, so an entry left in place keeps everything it granted.

A patient membership with no access policy and no "Access" entries can read and change every record in the project, so make sure none is left that way.

A project that sets `defaultPatientAccessPolicy` lets patients register themselves, and gives them that policy instead. Medplum sets it on projects created with versions 5.1.17 to 5.2.2. The portal has no self-registration yet, so remove the field on the project's JSON page. If the clinic creates patients through SCIM, which needs the field, point it at the portal's policy instead; patients can then still register themselves, with the portal's policy.

When an update to the portal changes the policy file, open the policy's JSON page (`/AccessPolicy/<policy identifier>/json`), replace its `name` and `resource` with the file's, keep its `id`, and save. Medplum needs the `id` to update the policy in place.

## Scripts

| Command                 | What it does                                            |
| ----------------------- | ------------------------------------------------------- |
| `npm run serve`         | Starts the development server                           |
| `npm run build`         | Checks types and builds for production into `dist/`     |
| `npm test`              | Runs the tests once with Vitest                         |
| `npm run preview`       | Serves the production build                             |
| `npm run lint`          | Lints the TypeScript and JavaScript code with oxlint    |
| `npm run lint:markdown` | Lints the Markdown files with remark                    |
| `npm run format`        | Formats every file with Prettier                        |
| `npm run format:check`  | Checks the formatting of every file without changing it |

## Contributing

Every change goes through a reviewed pull request; nothing is pushed to `main` directly.

- A pre-commit hook checks the formatting, the code lint and the Markdown lint of the staged files. It reports problems and never changes the files.
- A pre-push hook refuses any push to `main`.
- Every pull request fills in the [pull request template](.github/pull_request_template.md).

## Data

Use synthetic data only: in code, tests, screenshots, issues and demos. Never put real patient data in this repository or anything linked from it.

## License

[Apache License 2.0](LICENSE), the license [Medplum](https://github.com/medplum/medplum) uses.
