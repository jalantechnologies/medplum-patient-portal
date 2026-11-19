import type { WithId } from "@medplum/core";
import type { AllergyIntolerance } from "@medplum/fhirtypes";

import type { ListRecordsParameters } from "./record-filter";
import type { RecordSearch } from "./record-list-tab";
import type { SearchPage } from "./search-page";

export type AllergyIntolerancePage = SearchPage<WithId<AllergyIntolerance>>;

export type AllergyIntoleranceSearch = RecordSearch<
  WithId<AllergyIntolerance>,
  AllergyIntolerancePage
>;

export type ListAllergyIntolerancesParameters =
  ListRecordsParameters<AllergyIntolerancePage>;
