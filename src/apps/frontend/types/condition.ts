import type { WithId } from "@medplum/core";
import type { Condition } from "@medplum/fhirtypes";

import type { ListRecordsParameters } from "./record-filter";
import type { RecordSearch } from "./record-list-tab";
import type { SearchPage } from "./search-page";

export type ConditionPage = SearchPage<WithId<Condition>>;

export type ConditionSearch = RecordSearch<WithId<Condition>, ConditionPage>;

export type ListConditionsParameters = ListRecordsParameters<ConditionPage>;
