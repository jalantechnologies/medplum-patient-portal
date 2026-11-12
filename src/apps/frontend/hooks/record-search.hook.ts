import { useMemo } from "react";

import type {
  AsynchronousResult,
  Nullable,
  RecordSearch,
  SearchPage,
} from "../types";
import useAsynchronousResult from "./asynchronous-result.hook";

const useRecordSearch = <
  Resource,
  Page extends SearchPage<Resource> = SearchPage<Resource>,
>(
  list: (
    patientReference: string,
    previousPage?: Nullable<Page>,
  ) => Promise<AsynchronousResult<Page>>,
): RecordSearch<Resource, Page> => {
  const { error, isLoading, isRequesting, load, result } =
    useAsynchronousResult(list);
  return useMemo(
    () => ({ error, isLoading, isRequesting, list: load, page: result }),
    [error, isLoading, isRequesting, load, result],
  );
};

export default useRecordSearch;
