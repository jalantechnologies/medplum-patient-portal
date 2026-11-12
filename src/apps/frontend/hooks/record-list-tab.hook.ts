import { useCallback, useEffect, type Key } from "react";

import type {
  Nullable,
  RecordListTab,
  RecordListTabText,
  RecordSearch,
  RecordSummary,
  SearchPage,
} from "../types";

interface RecordListTabSource<
  Resource,
  Page extends SearchPage<Resource>,
  Summary extends RecordSummary,
> extends RecordSearch<Resource, Page> {
  activeTabKey: Key;
  patientReference: string | undefined;
  summarize: (resource: Resource, page: Page) => Summary;
  text: RecordListTabText;
}

const useRecordListTab = <
  Resource,
  Page extends SearchPage<Resource>,
  Summary extends RecordSummary,
>({
  activeTabKey,
  error,
  isLoading,
  isRequesting,
  list,
  page,
  patientReference,
  summarize,
  text,
}: RecordListTabSource<Resource, Page, Summary>): RecordListTab<Summary> => {
  const listPage = useCallback(
    async (previousPage: Nullable<Page>) => {
      if (patientReference) {
        await Promise.allSettled([list(patientReference, previousPage)]);
      }
    },
    [list, patientReference],
  );
  const isOpen = activeTabKey === text.key;
  const isNotRequestedYet = isLoading && !isRequesting;

  useEffect(() => {
    if (isOpen && isNotRequestedYet) {
      void listPage(null);
    }
  }, [isNotRequestedYet, isOpen, listPage]);

  return {
    ...text,
    error,
    hasFailed: error !== null && page === null,
    hasMoreRecords: page !== null && page.nextPosition !== null,
    isLoading,
    isRequesting,
    listMoreRecords: () => void listPage(page),
    records: page
      ? page.resources.map((resource) => summarize(resource, page))
      : [],
    retry: () => listPage(page),
  };
};

export default useRecordListTab;
