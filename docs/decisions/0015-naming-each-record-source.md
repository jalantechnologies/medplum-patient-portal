# 0015. Naming each record's source

Status: Accepted
Date: 2026-11-17

## Context

- Decision [0013](0013-one-account-many-sources.md) keeps each record's source in `meta.source`, the source's address, and makes each source an `Organization` whose `urn:ietf:rfc:3986` identifier holds that address. It leaves open whether patients read source `Organization` records or the app relies on each reference's `display`.
- A page must show the source's name, such as "Oak Dermatology", not its address. Most records do not point to their source's `Organization`: in Eleanor Walsh's example data, only `DiagnosticReport`, `Observation` and `Procedure` do, through `performer`. A condition, an allergy or a prescription points to a clinician only, so no reference's `display` names the source.
- A `search` grant on a resource type that `%patient` cannot limit is a privacy hole. With it, `Organization?_has:Observation:performer:patient=Patient/<someone else>` lists the clinics that treated another patient. Medplum v5.2.17 applies a policy's criteria only to the outer search, not to a `_has` condition (`buildChainedSearchUsingReferenceTable`, `packages/server/src/fhir/search.ts`), the hole decision [0010](0010-patient-access-policy.md) closes for `Medication`.
- Medplum checks a resource brought by `_include` with `read`, and needs `search` only on the type searched (`validateSearchResourceTypes` in `search.ts`, `getSearchIncludeEntries` in `packages/fhir-router/src/search-include.ts`). `List` is in FHIR's Patient compartment through `subject`.

## Decision

1. **Each patient has a `List` of their sources**, with `subject` the patient and one entry per source pointing to its `Organization`. Home's "Available sources" counts the sources on it.
2. **The portal reads it once per visit to a page** that names sources: `List?subject=<patient>&status=current&_include=List:item:Organization`, every page of it. Each page's own hook starts the read, and the context only hands the answer on, as with every other shared result. Of the lists that come back, only a `working` one names sources: FHIR marks `List.status`, `List.mode` and `List.entry.deleted` as modifiers, a snapshot may be out of date, and a list of changes (the only kind FHIR's invariant lst-2 lets mark an entry `deleted`, which Medplum enforces) holds additions and removals, not the sources. Every `urn:ietf:rfc:3986` identifier of each listed `Organization` maps to its `name`; if two clinics share an address, the first listed keeps it. An address is compared exactly, as Medplum's `_source` search compares it, so that a record named for a source is also among that source's records when the patient chooses the source. Imports write the address exactly ([0013](0013-one-account-many-sources.md), rule 5). FHIR leaves the form of `Meta.source` to each server, and some, such as HAPI FHIR, add the request after a `#`; a record whose address arrives in such another form is named for no source. A clinic whose record is no longer active (`Organization.active` false) is still named on the records it sent.
3. **If the list cannot be read, the page says so.** The records stay listed without their source, and the page's error banner, the one its tabs use, offers "Try again", which reads the list again ([decision 0011](0011-shared-data-across-pages.md), rule 6). A failure on any page of the list fails the whole read, so no page shows some sources and silently drops others.
4. **The access policy grants `List` with `List?subject=%patient` and `search`, and `Organization` with `read` only.** No patient can search clinics.
5. **"Received" is the record's `meta.lastUpdated`**: when the platform received the version shown. Medplum sets it on every change and leaves it alone when a load changes nothing. That reads true because only imports change a patient's records (decision [0013](0013-one-account-many-sources.md)); FHIR defines `lastUpdated` as when the resource last changed, so anything else that changes a record, such as a Bot that tags it or an edit in Medplum's app, would move "Received" to that day.
6. **"Source updated" is shown only for a test report**, from `DiagnosticReport.issued`, which FHIR defines as when this version was made available. Other record types have no field for when their source last changed them.

## Consequences

- Health records, Medications and Test results name each record's source from its `meta.source`. A clinician or lab named on the same line (author, prescriber, performer) is shown too, and a source that is also that name is shown once, as in the prototype's "Collected October 18, 2026 · Harbor Laboratory". Test results adds when the source updated the report and when it was received.
- A record whose source is not on the patient's list, or that names no source, shows none.
- Home counts the clinics on the patient's list ("Available sources: 4 sources"), each listed clinic once, and lists up to three of their care plans with each plan's clinic: the ongoing ones first, then the others, each newest first by the plan's period, so a plan that is done never hides an ongoing one. A plan only proposed or offered as an option (`CarePlan.intent` `proposal` or `option`) and a draft are not care the patient is under, so Home's list of care plans leaves them out, as Medications leaves out what was never prescribed.
- Home's "Connected records" says when the portal last received any of the patient's records: the newest `meta.lastUpdated` across every record type the access policy lets a patient search, other than this list, read in one batch of searches sorted by `_lastUpdated`, one record each. The policy's `%patient` criteria keep every search to the patient's own records.
- Every import, such as a Bot that brings in a hospital's records, writes the patient's list along with the records, as a `current`, `working` list, and changes a record only when its source changed it, so that "Received" stays true.
- Bots that may run at the same time change the list with FHIR's versioned update: `If-Match` with the version they read ([managing resource contention](https://hl7.org/fhir/R4/http.html#concurrency)). When another import changed the list first, Medplum answers 412 Precondition Failed, and the Bot reads the list again and retries, so no import drops another's source.
- The example data, loaded with `npm run load:example`, moves its dates to the day it is loaded, so loading it again on a later day changes every dated record and moves "Received" to that day.
- Nothing but an import may change a patient's records; a Bot or an admin edit that does moves "Received".
- A project admin updates the policy in place, as the README describes.

## Alternatives considered

- **`search` on `Organization`, by identifier.** Not chosen: the `_has` hole above.
- **The source's name copied onto each record.** Not chosen: FHIR R4 has no field for it on most resource types.
- **A `Provenance` per record.** Not chosen in [0013](0013-one-account-many-sources.md): one more resource and search per record.
