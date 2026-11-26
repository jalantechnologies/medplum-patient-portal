import type { WithId } from "@medplum/core";
import type { Procedure } from "@medplum/fhirtypes";

import type { ListRecordsParameters } from "./record-filter";
import type { RecordSearch } from "./record-list-tab";
import type { SearchPage } from "./search-page";

export type ProcedurePage = SearchPage<WithId<Procedure>>;

export type ProcedureSearch = RecordSearch<WithId<Procedure>, ProcedurePage>;

export type ListProceduresParameters = ListRecordsParameters<ProcedurePage>;
