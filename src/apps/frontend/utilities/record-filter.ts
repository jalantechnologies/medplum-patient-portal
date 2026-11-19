import type { Nullable, RecordFilter } from "../types";

export const isSameRecordFilter = (
  otherRecordFilter: Nullable<RecordFilter>,
  recordFilter: Nullable<RecordFilter>,
): boolean =>
  otherRecordFilter !== null &&
  recordFilter !== null &&
  otherRecordFilter.text === recordFilter.text &&
  otherRecordFilter.sourceAddresses.length ===
    recordFilter.sourceAddresses.length &&
  otherRecordFilter.sourceAddresses.every(
    (sourceAddress, index) =>
      sourceAddress === recordFilter.sourceAddresses[index],
  );
