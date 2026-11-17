const DETAIL_SEPARATOR = " · ";

export const joinDetails = (...details: string[]): string =>
  details.filter(Boolean).join(DETAIL_SEPARATOR);

export const omitRepeatedDetail = (
  detail: string,
  shownDetail: string,
): string => (detail === shownDetail ? "" : detail);
