import type { WithId } from "@medplum/core";
import type { Observation } from "@medplum/fhirtypes";

import type { ListRecordsParameters } from "./record-filter";
import type { RecordSearch } from "./record-list-tab";
import type { SearchPage } from "./search-page";

export type VitalSignPage = SearchPage<WithId<Observation>>;

export type VitalSignSearch = RecordSearch<WithId<Observation>, VitalSignPage>;

export type ListVitalSignsParameters = ListRecordsParameters<VitalSignPage>;
