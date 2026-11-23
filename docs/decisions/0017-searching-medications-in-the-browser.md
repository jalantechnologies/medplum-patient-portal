# 0017. Searching Medications in the browser

Status: Accepted
Date: 2026-11-23

## Context

- A patient with medicines from several clinics finds a prescription by its medicine's name, as on Health records and Test results ([#52](https://github.com/jalantechnologies/medplum-patient-portal/issues/52)). Those two pages send Medplum `code:text`, which the server runs, so a match on a later page is found.
- A prescription names its medicine in one of four places, and Medications already shows each of them: written on the prescription (`medicationCodeableConcept`), the name on its reference (`medicationReference.display`), a `Medication` contained in the prescription, or a separate `Medication` record it refers to ([FHIR R4](https://hl7.org/fhir/R4/medicationrequest-definitions.html#MedicationRequest.medication_x_)). US Core lets a source send either a code or a reference, which "may be contained or an external resource", and says "The Client application SHALL support all methods" ([US Core MedicationRequest](https://hl7.org/fhir/us/core/StructureDefinition-us-core-medicationrequest.html)).
- FHIR R4 defines `MedicationRequest`'s `code` search parameter as `(MedicationRequest.medication as CodeableConcept)` ([search parameters](https://hl7.org/fhir/R4/medicationrequest.html#search)), so `code:text` finds only a medicine written on the prescription.
- Searching through the reference, `medication.code:text`, is a chained search. Medplum runs it only when the user may `search` the chained type (`validateSearchResourceType` in [`search.ts`](https://github.com/medplum/medplum/blob/main/packages/server/src/fhir/search.ts)). The portal's policy grants `Medication` `read` only, never `search`, because a `search` grant lets one patient list another patient's medicines through `_has` ([0010](0010-patient-access-policy.md)). On a local Medplum 5.2.18 server on 2026-11-23, the example patient's `MedicationRequest?medication.code:text=cetiri` was refused as forbidden. A contained medicine and the name on a reference cannot be searched at all.
- Medplum's `:text` on a code finds the text anywhere in the code's text or in one of its codings' names, ignoring letter case (`buildTokenColumnsWhereConditionTextAndContains` in [`token-column.ts`](https://github.com/medplum/medplum/blob/main/packages/server/src/fhir/token-column.ts)).

## Decision

1. With no search text, Medications reads one page of prescriptions at a time, as before.
2. With a search text, the portal reads every prescription in the open tab. The server still limits them to the patient, the tab's orders and statuses, and the chosen source. They arrive 100 at a time with the medicine each refers to, and a medicine version Medplum does not send is read as the list reads it.
3. While the patient changes the search text, the portal filters the prescriptions it has read, or is still reading, and reads nothing more. It reads them again for another tab or source, after the search is cleared, after a read fails, and each time the patient opens Medications.
4. The portal keeps the prescriptions where any name of the medicine contains the text, ignoring letter case, as Medplum's `:text` does:
   - the text written on the prescription and each of its codings' names;
   - the name on its reference;
   - for the medicine it contains or refers to, unless that medicine was entered in error: its code text and coding names, its ingredients' names together, and each ingredient's names.

   A prescription's title is the first of these names, so a search for the name a prescription shows always finds it.

5. Every match shows at once, newest first with the undated ones last, so the list has no "Show more" while a search is open.
6. The access policy does not change.

## Consequences

- A patient finds a prescription by any name its medicine has, however the source named it.
- The first search text reads every prescription in the tab, 100 to a request, the undated ones in requests of their own, so a patient with many prescriptions waits longer for it than for the first page. Each later text is answered from that read.
- A prescription that reaches Medplum while a search stays open shows once the search is cleared or Medications is opened again.
- Medplum refuses to read past its search offset limit, 10,000 by default (`maxSearchOffset`), so a tab with more prescriptions than that cannot be searched. The same limit already stops "Show more" at that point on every list.
- Medications compares names in the browser, Health records and Test results on the server. They agree for a name written on a record, so a change to how one of them matches is checked against the other.

## Alternatives considered

- **`search` on `Medication`, with the chained search `medication.code:text`.** It reopens the `_has` path that [0010](0010-patient-access-policy.md) closes.
- **Finding the matching medicines first, then one server search with `_filter`** for "the written name matches, or the prescription refers to one of these medicines". It keeps "Show more", but it still reads every prescription that refers to a medicine, adds a request, and cannot find a contained medicine or the name on a reference.
- **The server's `code:text` alone, as on the other two pages.** A prescription that names its medicine in any other place would never be found.
