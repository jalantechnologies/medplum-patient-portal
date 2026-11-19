import { useCallback, useEffect, type Key } from "react";

import type {
  Nullable,
  RecordListFilter,
  RecordListTab,
  RecordListTabText,
  RecordSearch,
  RecordSummary,
  SearchPage,
} from "../types";
import { isSameRecordFilter } from "../utilities";

interface RecordListTabSource<
  Resource,
  Page extends SearchPage<Resource>,
  Summary extends RecordSummary,
>
  extends RecordSearch<Resource, Page>, RecordListFilter {
  activeTabKey: Key;
  patientReference: string | undefined;
  summarize: (resource: Resource, page: Page) => Summary;
  text: RecordListTabText;
}

type CurrentRecordSearchSource<
  Resource,
  Page extends SearchPage<Resource>,
> = Pick<
  RecordSearch<Resource, Page>,
  "error" | "page" | "pageRecordFilter" | "requestedRecordFilter"
> &
  Pick<RecordListFilter, "hasRecordFilterFailed" | "recordFilter">;

const readCurrentRecordSearch = <Resource, Page extends SearchPage<Resource>>({
  error,
  hasRecordFilterFailed,
  page,
  pageRecordFilter,
  recordFilter,
  requestedRecordFilter,
}: CurrentRecordSearchSource<Resource, Page>) => {
  const isCurrentRequest = isSameRecordFilter(
    requestedRecordFilter,
    recordFilter,
  );
  const currentPage = isSameRecordFilter(pageRecordFilter, recordFilter)
    ? page
    : null;
  const currentError = isCurrentRequest ? error : null;
  return {
    currentError,
    currentPage,
    hasFailed:
      currentPage === null &&
      (currentError !== null ||
        (recordFilter === null && hasRecordFilterFailed)),
    isCurrentRequest,
  };
};

const useRecordListTab = <
  Resource,
  Page extends SearchPage<Resource>,
  Summary extends RecordSummary,
>({
  activeTabKey,
  clearRecordFilter,
  isFiltered,
  isRequesting,
  list,
  patientReference,
  recordFilter,
  summarize,
  text,
  ...recordSearchState
}: RecordListTabSource<Resource, Page, Summary>): RecordListTab<Summary> => {
  const { currentError, currentPage, hasFailed, isCurrentRequest } =
    readCurrentRecordSearch({ ...recordSearchState, recordFilter });
  const listPage = useCallback(
    async (previousPage: Nullable<Page>) => {
      if (patientReference && recordFilter) {
        await Promise.allSettled([
          list({ patientReference, previousPage, recordFilter }),
        ]);
      }
    },
    [list, patientReference, recordFilter],
  );
  const isOpen = activeTabKey === text.key;
  const isNotRequestedYet = recordFilter !== null && !isCurrentRequest;

  useEffect(() => {
    if (isOpen && isNotRequestedYet) {
      void listPage(null);
    }
  }, [isNotRequestedYet, isOpen, listPage]);

  return {
    ...text,
    clearRecordFilter,
    error: currentError,
    hasFailed,
    hasMoreRecords: currentPage !== null && currentPage.nextPosition !== null,
    isFiltered,
    isLoading: currentPage === null && !hasFailed,
    isRequesting: isCurrentRequest && isRequesting,
    listMoreRecords: () => void listPage(currentPage),
    records: currentPage
      ? currentPage.resources.map((resource) =>
          summarize(resource, currentPage),
        )
      : [],
    retry: () => listPage(currentPage),
  };
};

export default useRecordListTab;
