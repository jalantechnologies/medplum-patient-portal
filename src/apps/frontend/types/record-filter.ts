import type { ImperativeMethods } from "baseui/select";
import type { RefObject } from "react";

import type { Nullable } from "./common";
import type { RecordSource } from "./record-source";

export interface RecordFilter {
  sourceAddresses: string[];
  text: string;
}

export interface ListRecordsParameters<Page> {
  patientReference: string;
  previousPage: Nullable<Page>;
  recordFilter: RecordFilter;
}

export interface RecordListFilter {
  clearRecordFilter: () => void;
  hasRecordFilterFailed: boolean;
  isFiltered: boolean;
  recordFilter: Nullable<RecordFilter>;
}

export interface RecordFilterChoices {
  changeSearchText: (searchText: string) => void;
  hasRecordSourcesFailed: boolean;
  isSearchable: boolean;
  isWaitingForSources: boolean;
  searchInputRef: RefObject<HTMLInputElement>;
  searchText: string;
  selectSource: (sourceIdentifier: Nullable<string>) => void;
  selectedSourceIdentifier: Nullable<string>;
  sourceControlRef: RefObject<ImperativeMethods>;
  sources: readonly RecordSource[];
}
