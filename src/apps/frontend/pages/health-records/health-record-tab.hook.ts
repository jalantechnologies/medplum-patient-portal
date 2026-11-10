import { useCallback, useEffect, type Key } from "react";

import type {
  AsynchronousOperationError,
  Nullable,
  SearchPage,
} from "../../types";
import type { HealthRecordSummary } from "./health-record-summary";

export const HEALTH_RECORD_TAB_TEXT = {
  CONDITIONS: {
    emptyDescription: "No condition information has been shared.",
    emptyTitle: "No conditions available",
    key: "conditions",
    title: "Conditions",
  },
  ALLERGIES: {
    emptyDescription: "No allergy information has been shared.",
    emptyTitle: "No allergies available",
    key: "allergies",
    title: "Allergies",
  },
  MEASUREMENTS: {
    emptyDescription: "No measurement information has been shared.",
    emptyTitle: "No measurements available",
    key: "measurements",
    title: "Measurements",
  },
} as const;

type HealthRecordTabText =
  (typeof HEALTH_RECORD_TAB_TEXT)[keyof typeof HEALTH_RECORD_TAB_TEXT];

export interface HealthRecordTab {
  emptyDescription: string;
  emptyTitle: string;
  hasFailed: boolean;
  hasMoreRecords: boolean;
  isLoading: boolean;
  isRequesting: boolean;
  key: string;
  listMoreRecords: () => void;
  records: HealthRecordSummary[];
  title: string;
}

interface HealthRecordTabSource<Resource> {
  activeTabKey: Key;
  error: Nullable<AsynchronousOperationError>;
  isLoading: boolean;
  isRequesting: boolean;
  list: (
    patientReference: string,
    previousPage?: Nullable<SearchPage<Resource>>,
  ) => Promise<unknown>;
  page: Nullable<SearchPage<Resource>>;
  patientReference: string | undefined;
  summarize: (resource: Resource) => HealthRecordSummary;
  text: HealthRecordTabText;
}

const useHealthRecordTab = <Resource>({
  activeTabKey,
  error,
  isLoading,
  isRequesting,
  list,
  page,
  patientReference,
  summarize,
  text,
}: HealthRecordTabSource<Resource>) => {
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

  const tab: HealthRecordTab = {
    ...text,
    hasFailed: error !== null && page === null,
    hasMoreRecords: page !== null && page.nextPosition !== null,
    isLoading,
    isRequesting,
    listMoreRecords: () => void listPage(page),
    records: (page?.resources ?? []).map(summarize),
  };
  return { error, retry: () => listPage(page), tab };
};

export default useHealthRecordTab;
