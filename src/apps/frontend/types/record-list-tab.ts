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

export interface RetryableRequest {
  error: Nullable<AsynchronousOperationError>;
  retry: () => Promise<void>;
}

export interface RecordSearch<
  Resource,
  Page extends SearchPage<Resource> = SearchPage<Resource>,
> {
  error: Nullable<AsynchronousOperationError>;
  isLoading: boolean;
  isRequesting: boolean;
  list: (
    patientReference: string,
    previousPage?: Nullable<Page>,
  ) => Promise<unknown>;
  page: Nullable<Page>;
}

export interface RecordListTab<Summary extends RecordSummary>
  extends RecordListTabText, RetryableRequest {
  hasFailed: boolean;
  hasMoreRecords: boolean;
  isLoading: boolean;
  isRequesting: boolean;
  listMoreRecords: () => void;
  records: Summary[];
}
