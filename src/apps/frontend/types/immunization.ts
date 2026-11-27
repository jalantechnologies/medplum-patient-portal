import type { WithId } from "@medplum/core";
import type { Immunization } from "@medplum/fhirtypes";

import type { ListRecordsParameters } from "./record-filter";
import type { RecordSearch } from "./record-list-tab";
import type { SearchPage } from "./search-page";

export type ImmunizationPage = SearchPage<WithId<Immunization>>;

export type ImmunizationSearch = RecordSearch<
  WithId<Immunization>,
  ImmunizationPage
>;

export type ListImmunizationsParameters =
  ListRecordsParameters<ImmunizationPage>;
