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
  Summary extends RecordSummary,
> extends RecordSearch<Resource> {
  activeTabKey: Key;
  patientReference: string | undefined;
  summarize: (resource: Resource) => Summary;
  text: RecordListTabText;
}

const useRecordListTab = <Resource, Summary extends RecordSummary>({
  activeTabKey,
  error,
  isLoading,
  isRequesting,
  list,
  page,
  patientReference,
  summarize,
  text,
}: RecordListTabSource<Resource, Summary>): RecordListTab<Summary> => {
  const listPage = useCallback(
    async (previousPage: Nullable<SearchPage<Resource>>) => {
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
    records: (page?.resources ?? []).map(summarize),
    retry: () => listPage(page),
  };
};

export default useRecordListTab;
