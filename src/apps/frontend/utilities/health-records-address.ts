import type { Key } from "react";

import routes, {
  HEALTH_RECORDS_TAB,
  ROUTE_SEARCH_PARAMETER,
} from "../constants/routes";

type HealthRecordsTabKey =
  (typeof HEALTH_RECORDS_TAB)[keyof typeof HEALTH_RECORDS_TAB]["key"];

const healthRecordsTabKeys: HealthRecordsTabKey[] = Object.values(
  HEALTH_RECORDS_TAB,
).map(({ key }) => key);

export const buildHealthRecordsTabSearch = (
  tabKey: Key,
  search: URLSearchParams = new URLSearchParams(),
): URLSearchParams => {
  const tabSearch = new URLSearchParams(search);
  tabSearch.set(ROUTE_SEARCH_PARAMETER.TAB, String(tabKey));
  return tabSearch;
};

export const buildHealthRecordsTabPath = (
  tabKey: HealthRecordsTabKey,
): string => `${routes.HEALTH_RECORDS}?${buildHealthRecordsTabSearch(tabKey)}`;

export const readHealthRecordsTabKey = (
  search: URLSearchParams,
): HealthRecordsTabKey => {
  const requestedTabKey = search.get(ROUTE_SEARCH_PARAMETER.TAB);
  return (
    healthRecordsTabKeys.find((tabKey) => tabKey === requestedTabKey) ??
    HEALTH_RECORDS_TAB.CONDITIONS.key
  );
};
