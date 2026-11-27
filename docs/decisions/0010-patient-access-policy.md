# 0010. Patient access policy

Status: Accepted
Date: 2026-11-05

## Context

Sources: Medplum's [access policies](https://www.medplum.com/docs/access/access-policies) (Patient Access, Default Access Policies), its [access control decision guide](https://www.medplum.com/docs/decision-guides/access-control) and its [rules for applications](https://www.medplum.com/ai/medplum-rules.md): "Enforce via `AccessPolicy` + `ProjectMembership` (`%patient`/`%org` variables), never app-layer filtering."

- A patient's sign-in gives them a token for their project membership. With it they can call Medplum's FHIR API directly, not only through the portal's screens. What the token can read or change is set by the membership's access policy, and nothing else.
- **A patient membership with no access policy can read and change every record in the project.** Medplum 5.2.13 keeps this as legacy behavior (`buildAccessPolicy` in [`fhir/accesspolicy.ts`](https://github.com/medplum/medplum/blob/v5.2.13/packages/server/src/fhir/accesspolicy.ts) grants `*`). A membership has none when the project has no patient default and the invite names no policy ([`admin/invite.ts`](https://github.com/medplum/medplum/blob/v5.2.13/packages/server/src/admin/invite.ts)), or when it is created or edited outside the invite.
- A membership's `access` entries are added to its `accessPolicy` (the same `buildAccessPolicy`). Moving a patient to a new policy leaves whatever an old entry grants.
- Projects created on Medplum 5.2 come with a "Default Patient Access Policy", which an invite applies when it names no policy. It limits a patient to their own compartment (`%patient`) on 21 resource types, with read and write on each.
- The portal searches ten resource types for the signed-in patient: `CarePlan` and `List` (each `subject`), and `Appointment`, `Condition`, `AllergyIntolerance`, `Observation`, `MedicationRequest`, `DiagnosticReport`, `Procedure` and `Immunization` (each `patient`). The `List` is the patient's list of sources ([0015](0015-naming-each-record-source.md)). It writes nothing.
- The portal reads two more types, which describe no patient, through `_include`: the `Medication` a prescription points to (`_include=MedicationRequest:medication`), and the `Organization` of each source on the patient's list (`_include=List:item:Organization`). Medplum's `_include` returns a medicine's current version, so a prescription that names an earlier version has that version read on its own. Medplum's server checks each included resource with `read`, and leaves out, with no error, any the policy does not grant `read` on (`readReferences` in [`search-include.ts`](https://github.com/medplum/medplum/blob/v5.2.17/packages/fhir-router/src/search-include.ts)).
- Test results finds each report's results with a search by `_id`, not `_include`: Medplum fails a search whose matches and included resources pass 1,000 (`getExtraEntries` in the same file), as seen on a local 5.2.17 server.
- The patient's own `Patient` comes from `/auth/me`, which Medplum reads with its system repository ([`auth/me.ts`](https://github.com/medplum/medplum/blob/v5.2.13/packages/server/src/auth/me.ts)), so the token needs no access to `Patient`.
- A patient's compartment reaches past their own records. An `Appointment` joins it through any participant, a `CarePlan` through an activity performer as well as its subject, and a `Patient` through `link` ([patient compartment](https://hl7.org/fhir/R4/compartmentdefinition-patient.html)).
- Medplum 5.2.13 deprecates an entry's `readonly` in favor of `interaction`, and ignores `readonly` on an entry that also lists `interaction` ([`access.ts`](https://github.com/medplum/medplum/blob/v5.2.13/packages/core/src/access.ts)).
- How patients register themselves depends on the Medplum release. Up to 5.2.17, a project allows it when `Project.defaultPatientAccessPolicy` is set, and gives each new patient that policy ([`auth/newpatient.ts`](https://github.com/medplum/medplum/blob/v5.2.17/packages/server/src/auth/newpatient.ts)). From 5.2.18 ([medplum/medplum#11363](https://github.com/medplum/medplum/pull/11363)), a project allows it only when its setting `openPatientRegistration` is on, and gives each new patient the `Patient` entry of `defaultAccessPolicies`, or `defaultPatientAccessPolicy` when that entry is missing ([`auth/utils.ts`](https://github.com/medplum/medplum/blob/v5.2.18/packages/server/src/auth/utils.ts)). The portal's patients sign up themselves ([0013](0013-one-account-many-sources.md), [0007](0007-authentication.md)).

Checked against a local Medplum 5.2.13 server, with two synthetic patients, Quinn and Harper, each with a care plan, a booked visit and a condition:

| What Quinn tries, with her own token           | No policy | Medplum's default | This policy |
| ---------------------------------------------- | --------- | ----------------- | ----------- |
| Search all patients                            | 16 found  | Only herself      | Forbidden   |
| Read Harper's patient, care plan and condition | Read      | Not found         | Forbidden   |
| Search Harper's care plans and visits          | Found     | None              | None        |
| See Home: ongoing care plans and next visit    | Works     | Works             | Works       |
| Read her own care plan by its identifier       | Read      | Read              | Forbidden   |
| Mark her own care plan revoked                 | Changed   | Changed           | Forbidden   |
| Create a care plan for herself                 | Created   | Created           | Forbidden   |
| Read her own condition by its identifier       | Read      | Read              | Forbidden   |

Harper's results mirror Quinn's. Three more checks:

- A care plan for Harper that lists Quinn as an activity performer stays hidden from Quinn. Under `CarePlan?_compartment=%patient`, as Medplum's default policy has it, Quinn finds that care plan.
- A visit with both Quinn and Harper as participants is found by both, and shows each of them the other.
- With the portal's policy as `accessPolicy` and Medplum's default left as an `access` entry, Quinn can still mark her own care plan revoked.

## Decision

- The portal ships its own access policy for patients, [`data/core/patient-access-policy.json`](../../data/core/patient-access-policy.json), in the `data/core/` folder Medplum's examples use for resources a deployment uploads.
- It grants only the interactions the portal uses, listed in `interaction`: `search` on the ten types the portal searches, each limited to the patient, and `read` on the two types it reads through `_include`, `Medication` (with `vread`) and `Organization`.
- Each search entry limits its type by the search parameter the portal itself searches on: `Appointment?patient=%patient`, `CarePlan?subject=%patient`, `List?subject=%patient`, and `?patient=%patient` for `Condition`, `AllergyIntolerance`, `Observation`, `MedicationRequest`, `DiagnosticReport`, `Procedure` and `Immunization`. Not `_compartment=%patient`, which also reaches records in which the patient is only a performer.
- A pull request that makes the portal read or write a new resource type, or use a new interaction, adds it to the policy and says so in its description.
- A report's results come through the `Observation` entry, so another patient's result that a report points to is not found.
- `Medication` and `Organization` name no patient and are outside the patient compartment, so `%patient` cannot limit them, and their entries have no criteria. They grant `read`, never `search`: with `search`, a patient could ask `Medication?_has:MedicationRequest:medication:patient=Patient/<another patient>`, and Medplum applies the policy's patient limit only to the outer search, not to the `_has` condition, so the answer would list the other patient's drugs. On a local 5.2.17 server, Quinn found Harper's synthetic sertraline this way. With `read` only, such a search is forbidden, and the portal gets each medicine with its prescription and each clinic with the patient's list, through `_include`, which Medplum checks with `read`.
  - `Medication` also grants `vread`, so a prescription that names an earlier version of a medicine shows that version. A patient who knows a medicine's identifier can read it, which shows a drug, not who takes it.
  - A patient who knows a clinic's identifier can read it, which shows a clinic, not who visits it.
  - A project whose policy lacks the `Medication` entry still lists every prescription: Medplum leaves out an included resource it may not read, with no error, so the drug's name falls back to "Medication".
- A test in `constants/fhir.test.ts` fills in `%patient` for two synthetic patients, the way Medplum's server does, and checks each entry with Medplum's own `satisfiedAccessPolicy`: a patient may search their own records of each type, may do nothing else with them, and may do nothing with the other patient's. It fails when the policy grants a type the test has no record for. A medicine may only be read, in any version, and a clinic may only be read. Another test checks that the search for when records were last received covers every record type the policy lets a patient search, other than the patient's list of sources, by the same parameter.
- The policy uses `%patient`, as Medplum's own patient policies do. For a patient it is their own profile; a caregiver's membership can pass a `patient` parameter instead.
- A project admin creates the policy in the Medplum project and sets it as the `Patient` entry of `Project.defaultAccessPolicies`, so every patient invited without a chosen policy gets it. Patients invited before are moved to it on their membership, with their `access` entries removed. The README gives the steps.
- Patients register themselves only with this policy. A project that does not offer sign-up leaves registration off: on Medplum 5.2.18 and later, by leaving `openPatientRegistration` off; on earlier releases, by leaving `defaultPatientAccessPolicy` unset. Projects created on Medplum 5.1.17 to 5.2.2 set it (its project setup in [v5.1.17](https://github.com/medplum/medplum/blob/v5.1.17/packages/server/src/fhir/operations/projectinit.ts) and [v5.2.2](https://github.com/medplum/medplum/blob/v5.2.2/packages/server/src/fhir/operations/projectinit.ts); [v5.2.3](https://github.com/medplum/medplum/blob/v5.2.3/packages/server/src/fhir/operations/projectinit.ts) does not), so on those earlier releases the README tells admins to remove it, or to point it at the portal's policy when they create patients through SCIM, which requires the field there ([`scim/utils.ts`](https://github.com/medplum/medplum/blob/v5.2.13/packages/server/src/scim/utils.ts)). Sign-up needs Medplum 5.2.18 or later, and turns registration on through `openPatientRegistration`, with this policy as the `Patient` entry of `defaultAccessPolicies`.
- Each change to the policy is checked against a real Medplum server with two synthetic patients, each seeing only their own record.

## Consequences

- A patient's token can only search their own care plans, conditions, allergies, test reports, observations, prescriptions, procedures, immunizations and lists, and the appointments they take part in; can read any medicine and any clinic in the project by its identifier; and can change nothing through the API.
- A visit shared by several patients shows each of them every participant.
- The policy grows with the portal, one reviewed pull request at a time, and a reviewer sees every widening of access in the diff.
- When an update to the portal changes the policy, each project's admin updates its copy of the `AccessPolicy` resource. The pull request and the release notes say so.
- A patient membership left with no policy and no `access` entries can still read and change every record in the project. The README tells admins to make sure none is.

## Alternatives considered

- **Medplum's Default Patient Access Policy, unchanged.** Nothing to set up on a new project, and it already keeps patients apart. Not chosen: it lets a patient change or create their own clinical records through the API (a care plan marked revoked in the check above), on resource types the portal never shows, and its contents follow Medplum's releases rather than the portal's.
- **`_compartment=%patient` for every type, as Medplum's default does.** One pattern for every type. Not chosen: a compartment also holds records in which the patient is only a performer, such as another patient's care plan.
- **`readonly` on each entry.** Grants read, vread, history and search. Not chosen: Medplum deprecates it, and the portal mostly searches.
- **`search` on `Medication` and `Organization`.** Not chosen: Medplum does not apply the patient limit to a `_has` condition, so a patient could list the medicines or clinics of another patient.
- **Filtering in the app.** Ruled out by Medplum's rules and `AGENTS.md`: a patient who calls the API directly is not stopped.
- **A setup script or Bot that applies the policy.** Not chosen: it needs admin credentials, and the policy is one resource to create.
