# 0012. Apache License 2.0

Status: Accepted
Date: 2026-11-12

## Context

- The repository is public. Without a license, nobody may legally copy, change or share its code ([GitHub docs](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository)).
- Medplum, which the app is built on, is licensed under Apache 2.0 ([LICENSE.txt](https://github.com/medplum/medplum/blob/main/LICENSE.txt)), and so are the packages the app uses, `@medplum/core` and `@medplum/react-hooks`.
- The choice was between Apache 2.0, the same license as Medplum, and MIT.

## Decision

License the app under the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0). The `LICENSE` file holds the license text as GitHub's license template has it, unchanged; `package.json` says `"license": "Apache-2.0"`, and the README's License section links to the file.

## Consequences

- Developers in Medplum's community find the same terms they already accept for Medplum.
- Every contributor grants a patent license for their contribution (section 3), and contributions are under the same license unless the contributor says otherwise (section 5), so no separate contributor agreement is needed.
- Anyone who redistributes the code keeps the license and states which files they changed (section 4).
- The repository has no `NOTICE` file and no copyright line. Adding one, as Medplum's [NOTICE](https://github.com/medplum/medplum/blob/main/NOTICE) does, needs the legal name of the copyright owner.

## Alternatives considered

- **MIT.** Not chosen: it is shorter, but it has no patent grant, and it would differ from the license of the platform the app is built on.
