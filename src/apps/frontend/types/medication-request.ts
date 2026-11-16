import type { WithId } from "@medplum/core";
import type { Medication, MedicationRequest } from "@medplum/fhirtypes";

import type { RecordSearch } from "./record-list-tab";
import type { SearchPage } from "./search-page";

export type MedicationsByReference = ReadonlyMap<string, Medication>;

export interface MedicationRequestPage extends SearchPage<
  WithId<MedicationRequest>
> {
  medications: MedicationsByReference;
}

export type MedicationRequestSearch = RecordSearch<
  WithId<MedicationRequest>,
  MedicationRequestPage
>;
