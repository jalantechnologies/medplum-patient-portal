import type { WithId } from "@medplum/core";
import type { AllergyIntolerance } from "@medplum/fhirtypes";

import type { SearchPreview } from "./search-preview";

export interface ActiveAllergyIntolerancePreview extends SearchPreview<
  WithId<AllergyIntolerance>
> {
  hasRecordedAllergyIntolerances: boolean;
}
