import { useCallback, useMemo, useState } from "react";

import {
  ServiceResponse,
  type AsynchronousResult,
  type ListRecordsParameters,
  type Nullable,
  type RecordFilter,
  type RecordSearch,
  type SearchPage,
} from "../types";
import { isSameRecordFilter } from "../utilities";
import useAsynchronousResult from "./asynchronous-result.hook";

interface FilteredPage<Page> {
  page: Nullable<Page>;
  recordFilter: RecordFilter;
}

// The records already held for a filter, with every page "Show more" added, are given again as the latest answer, so an answer still on its way for another filter is dropped.
const findHeldPage = <Page>(
  result: Nullable<FilteredPage<Page>>,
  { previousPage, recordFilter }: ListRecordsParameters<Page>,
): Nullable<FilteredPage<Page>> =>
  previousPage === null &&
  result !== null &&
  result.page !== null &&
  isSameRecordFilter(result.recordFilter, recordFilter)
    ? result
    : null;

const useRecordSearch = <
  Resource,
  Page extends SearchPage<Resource> = SearchPage<Resource>,
>(
  list: (
    parameters: ListRecordsParameters<Page>,
  ) => Promise<AsynchronousResult<Page>>,
): RecordSearch<Resource, Page> => {
  const [requestedRecordFilter, setRequestedRecordFilter] =
    useState<Nullable<RecordFilter>>(null);
  const listFilteredPage = useCallback(
    async (
      parameters: ListRecordsParameters<Page>,
      heldPage: Nullable<FilteredPage<Page>>,
    ) => {
      if (heldPage) {
        return new ServiceResponse(heldPage);
      }
      const { data } = await list(parameters);
      return new ServiceResponse<FilteredPage<Page>>({
        page: data ?? null,
        recordFilter: parameters.recordFilter,
      });
    },
    [list],
  );
  const { error, isRequesting, load, result } =
    useAsynchronousResult(listFilteredPage);
  const listRecords = useCallback(
    (parameters: ListRecordsParameters<Page>) => {
      setRequestedRecordFilter(parameters.recordFilter);
      return load(parameters, findHeldPage(result, parameters));
    },
    [load, result],
  );
  return useMemo(
    () => ({
      error,
      isRequesting,
      list: listRecords,
      page: result?.page ?? null,
      pageRecordFilter: result?.recordFilter ?? null,
      requestedRecordFilter,
    }),
    [error, isRequesting, listRecords, requestedRecordFilter, result],
  );
};

export default useRecordSearch;
