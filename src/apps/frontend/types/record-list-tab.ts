import type { AsynchronousOperationError } from "./asynchronous-operation";
import type { Nullable } from "./common";
import type { ListRecordsParameters, RecordFilter } from "./record-filter";
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
  isRequesting: boolean;
  list: (parameters: ListRecordsParameters<Page>) => Promise<unknown>;
  page: Nullable<Page>;
  pageRecordFilter: Nullable<RecordFilter>;
  requestedRecordFilter: Nullable<RecordFilter>;
}

export interface RecordListTab<Summary extends RecordSummary>
  extends RecordListTabText, RetryableRequest {
  clearRecordFilter: () => void;
  hasFailed: boolean;
  hasMoreRecords: boolean;
  isFiltered: boolean;
  isLoading: boolean;
  isRequesting: boolean;
  listMoreRecords: () => void;
  records: Summary[];
}
