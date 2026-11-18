# 0013. One account, many sources

Status: Accepted
Date: 2026-11-16

## Context

- **The goal:** a patient seen at Hospital A, then Clinic B, then Hospital C signs in once, on this platform, and sees what each of them recorded, each record showing where it came from. The [design prototype](https://patientportal.jjalan.chatgpt.site/) shows the same: "Your health, connected", "4 sources", "Connected records", and a sign-up step that matches the patient's records through Health Gorilla.
- **A patient's sign-in names one Medplum project** ([0007](0007-authentication.md)), so where the records live decides what one sign-in can show.
- **Medplum's guidance**, read in Medplum's repository at revision `8d13bbf8c`:
  - [Data migration decision guide](https://www.medplum.com/docs/decision-guides/data-migration) (`packages/docs/content/docs/decision-guides/data-migration.md`), "How will identifiers, matching, and deduplication work?": "Preserve source identifiers using a different identifier system URI for each source."
  - [Mapping governance](https://www.medplum.com/docs/migration/mapping-governance), "Preserve Provenance and Traceability": "Where appropriate, use `meta.source` for a governed source URI." A `Provenance` per resource is optional, and "Do not assume patient access propagates through `Provenance.target`".
  - [Access control decision guide](https://www.medplum.com/docs/decision-guides/access-control), "How will patients register?": open self-registration is the `Project.setting` `openPatientRegistration` set to `true`, with a Patient policy in `defaultAccessPolicies`.
  - [Project vs server scoped users](https://www.medplum.com/docs/user-management/project-vs-server-scoped-users): patients are project-scoped by default; users that work across projects are for developers and administrators.
  - Medplum's server keeps the `meta.source` a client sends and sets `versionId`, `lastUpdated` and `author` itself (`updateResourceImpl` in `packages/server/src/fhir/repo.ts`).
- **FHIR R4** defines [`Meta.source`](https://hl7.org/fhir/R4/resource.html#Meta) as "A uri that identifies the source system of the resource", which "may identify another FHIR server, document, message, database, etc."
- **Where records come from**, in order: synthetic clinics, then hospitals the patient names through each EHR's patient API, then a national network, then clinics on Medplum.

## Decision

1. **One platform project.** The platform runs one Medplum project. Every patient's account and every record from every source live in it. The app's configuration names one server and one project, the platform's.
2. **Open sign-up:** a patient creates their own account through Medplum's open patient registration, and gets the portal's access policy. On Medplum's `main` that is the `Project.setting` `openPatientRegistration`, with the portal's policy as the `Patient` entry of `defaultAccessPolicies`; up to Medplum 5.2.17 it is the project's `defaultPatientAccessPolicy`.
3. **One `Patient` per person.** The patient's profile on the platform is their only `Patient`. A source's own patient number for them is kept as an extra `identifier` on it, not as a second `Patient`.
4. **Each source is an `Organization`** in the project, with its name and an `identifier` whose system is `urn:ietf:rfc:3986` and whose value is the source's address, such as its FHIR server's base address.
5. **Every record from a source carries:**
   - `meta.source`: the source's address, exactly the value of its `Organization` identifier, even when the source's own server sends a longer form, such as one with the request after a `#`.
   - An `identifier` whose system is the source's address followed by the resource type (`https://fhir.oak-dermatology.example/Condition`) and whose value is the record's identifier at the source. Loading the same record again updates it in place (a conditional update) instead of copying it.
   - References to the source's clinicians and `Organization` in the fields FHIR has for them (`recorder`, `performer`, `author`, `requester`), each with its `display`.
6. **Synthetic sources use addresses under `.example`**, a top-level domain reserved for examples ([RFC 2606](https://www.rfc-editor.org/rfc/rfc2606)), such as `https://fhir.oak-dermatology.example`.
7. **Records from different sources stay separate.** Two sources may record the same medicine or condition. The portal shows each with its source and does not merge them.

Settled in other records:

- how the patient's list of connected sources is kept: [0015](0015-naming-each-record-source.md)
- when a record was received and when its source last changed it: [0015](0015-naming-each-record-source.md)
- whether patients read source `Organization` records or the app relies on each reference's `display`: [0015](0015-naming-each-record-source.md)
- where a patient's connection tokens are kept: a later decision, before the first connection to a hospital is built

## Consequences

- As in [0001](0001-frontend-only-app-on-medplum.md), the portal has no server of its own: Medplum is the backend, and Bots run server-side logic, such as fetching a patient's records from a hospital.
- Every page can show a record's source from its own fields, with no extra request per record.
- A clinic can run its own copy: the same app with one source. Nothing is built only for that case.
- Searches can be narrowed to one source with Medplum's `_source` search parameter ([advanced search parameters](https://www.medplum.com/docs/search/advanced-search-parameters)), for the "All sources" filter the design prototype shows. A `_source` search matches the whole address exactly ([FHIR search](https://hl7.org/fhir/R4/search.html#uri)), and rule 5 writes the address exactly, so the search finds every record from the source.

## Alternatives considered

- **A Medplum project per clinic, with the patient a member of each.** Not chosen: Medplum keeps patient users inside one project, a sign-in token covers one membership, so no page could show records from every clinic at once, and hospitals on Epic or Oracle are not Medplum projects.
- **The source kept only in a `Provenance` per record.** Not chosen: an extra resource for every record and an extra search on every page, and Medplum warns that patient access does not follow `Provenance.target`. It stays available for a source that needs more than an address.
- **The source kept in `meta.tag`.** Not chosen: `meta.source` is the FHIR field for a record's source system.
