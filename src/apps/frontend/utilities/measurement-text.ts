import {
  formatObservationValue,
  formatQuantity,
  formatRange,
  formatWallTime,
} from "@medplum/core";
import type { Period, Ratio } from "@medplum/fhirtypes";

import constant from "../constants";
import type { Measurement } from "../types";
import { formatRecordDate } from "./fhir-text";

const RATIO_SEPARATOR = ":";
const RANGE_SEPARATOR = " - ";

const formatRatio = ({ denominator, numerator }: Ratio): string => {
  const sides = [formatQuantity(numerator), formatQuantity(denominator)];
  return sides.some(Boolean) ? sides.join(RATIO_SEPARATOR) : "";
};

const formatPeriodOnPatientCalendar = ({ end, start }: Period): string => {
  const startDate = formatRecordDate(start);
  const endDate = formatRecordDate(end);
  if (startDate && endDate) {
    return [startDate, endDate].join(RANGE_SEPARATOR);
  }
  if (startDate) {
    return `From ${startDate}`;
  }
  return endDate && `Until ${endDate}`;
};

const formatOtherValue = (measurement: Measurement): string => {
  if (measurement.valueInteger !== undefined) {
    return String(measurement.valueInteger);
  }
  if (measurement.valueBoolean !== undefined) {
    return measurement.valueBoolean ? "Yes" : "No";
  }
  if (measurement.valueRatio) {
    return formatRatio(measurement.valueRatio);
  }
  if (measurement.valueRange) {
    return formatRange(measurement.valueRange);
  }
  if (measurement.valuePeriod) {
    return formatPeriodOnPatientCalendar(measurement.valuePeriod);
  }
  if (measurement.valueSampledData) {
    return "Device recording, not shown here";
  }
  return (
    formatRecordDate(measurement.valueDateTime) ||
    formatWallTime(measurement.valueTime, constant.LOCALE)
  );
};

export const formatMeasurementValue = (measurement: Measurement): string =>
  formatObservationValue(measurement) || formatOtherValue(measurement);
