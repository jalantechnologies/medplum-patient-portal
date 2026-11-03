# Patient Portal

An open source patient portal for clinics that run on [Medplum](https://www.medplum.com/), built by [Better](https://btr.group/).

A patient signs in on a phone or a laptop and sees their own health record, manages appointments, messages their care team, follows their care plans and sees their bills. A clinic deploys it against its own Medplum project.

## Status

Early development. The project is set up; the first screens come next.

## Prerequisites

- Node.js 26.13.0, the version in `.nvmrc`. With nvm, run `nvm use` in the project folder.

## Getting started

```sh
npm install
npm run serve
```

Then open the address the development server prints.

## Scripts

| Command                 | What it does                                            |
| ----------------------- | ------------------------------------------------------- |
| `npm run serve`         | Starts the development server                           |
| `npm run build`         | Checks types and builds for production into `dist/`     |
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

Not chosen yet. The repository stays private until its first public release, and the license is chosen before then.
