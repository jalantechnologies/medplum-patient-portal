import type { AsynchronousOperationError } from "./asynchronous-operation";
import type { Nullable } from "./common";
import type { SearchPage } from "./search-page";

export interface RecordListTabText {
  emptyDescription: string;
  emptyTitle: string;
  key: string;
  title: string;
}

export interface RecordSummary {
  identifier: string;
}

export interface RecordSearch<Resource> {
  error: Nullable<AsynchronousOperationError>;
  isLoading: boolean;
  isRequesting: boolean;
  list: (
    patientReference: string,
    previousPage?: Nullable<SearchPage<Resource>>,
  ) => Promise<unknown>;
  page: Nullable<SearchPage<Resource>>;
}

export interface RecordListTab<
  Summary extends RecordSummary,
> extends RecordListTabText {
  error: Nullable<AsynchronousOperationError>;
  hasFailed: boolean;
  hasMoreRecords: boolean;
  isLoading: boolean;
  isRequesting: boolean;
  listMoreRecords: () => void;
  records: Summary[];
  retry: () => Promise<void>;
}
