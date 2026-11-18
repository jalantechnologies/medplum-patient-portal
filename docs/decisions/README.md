# Decision records

One file per consequential decision: what was decided, why, and what follows from it. A record is written and reviewed before the first code that depends on it. Once a record is accepted, its decision changes only through a new record that supersedes it. The record itself is edited only to correct a fact, such as a renamed file, or to add a row to a list it keeps, such as the departures in [0008](0008-departures-from-the-template.md) and the exceptions in [0006](0006-recommended-setup-with-default-settings.md).

| #                                                       | Decision                                                 | Status   |
| ------------------------------------------------------- | -------------------------------------------------------- | -------- |
| [0001](0001-frontend-only-app-on-medplum.md)            | A frontend-only app, with Medplum as the backend         | Accepted |
| [0002](0002-base-web-for-the-ui.md)                     | Base Web for the user interface                          | Accepted |
| [0003](0003-react-18.md)                                | React 18, because Base Web does not run on React 19      | Accepted |
| [0004](0004-better-frontend-conventions.md)             | Follow the frontend conventions of Better's web template | Accepted |
| [0005](0005-vite-as-the-build-tool.md)                  | Vite as the build tool                                   | Accepted |
| [0006](0006-recommended-setup-with-default-settings.md) | Vite's recommended setup, with default settings          | Accepted |
| [0007](0007-authentication.md)                          | Authentication                                           | Accepted |
| [0008](0008-departures-from-the-template.md)            | Where the frontend departs from Better's template        | Accepted |
| [0009](0009-folder-structure.md)                        | Folder structure                                         | Accepted |
| [0010](0010-patient-access-policy.md)                   | Patient access policy                                    | Accepted |
| [0011](0011-shared-data-across-pages.md)                | How shared data behaves across pages                     | Accepted |
| [0012](0012-apache-2-license.md)                        | Apache License 2.0                                       | Accepted |
| [0013](0013-one-account-many-sources.md)                | One account, many sources                                | Accepted |
| [0015](0015-naming-each-record-source.md)               | Naming each record's source                              | Accepted |

Number 0014 is held for where a patient's connection tokens are kept, which is decided before the first hospital connection is built.

A new record is proposed in a pull request, where it is reviewed and changed as needed, and is merged as **Accepted** once that pull request is approved.

## Format

```markdown
# NNNN. Title

Status: Accepted | Superseded by NNNN
Date: YYYY-MM-DD

## Context

What forces the decision: the facts, constraints and sources.

## Decision

What we will do.

## Consequences

What becomes easier, what becomes harder, and what we must now do.

## Alternatives considered

The real alternatives and why they were not chosen.
```
