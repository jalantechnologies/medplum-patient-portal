import { capitalize, formatDate, formatDateTime } from "@medplum/core";
import type { AllergyIntolerance, CodeableConcept } from "@medplum/fhirtypes";

import constant from "../constants";
import { DATE_FORMAT } from "../constants/date-format";

const CODE_WORD_SEPARATOR = "-";
const DATE_PART_SEPARATOR = "-";
const TIME_SEPARATOR = "T";

export const humanizeCode = (code: string | undefined): string =>
  code ? capitalize(code.replaceAll(CODE_WORD_SEPARATOR, " ")) : "";

export const nameCodeableConcept = (
  concept: CodeableConcept | undefined,
): string =>
  concept?.text ||
  concept?.coding?.find(({ display }) => display)?.display ||
  "";

export const nameAllergyIntolerance = (
  allergyIntolerance: AllergyIntolerance,
): string => nameCodeableConcept(allergyIntolerance.code) || "Allergy";

const selectCalendarDateFormat = (date: string) => {
  const [, month, day] = date.split(DATE_PART_SEPARATOR);
  if (day) {
    return DATE_FORMAT.DAY;
  }
  if (month) {
    return DATE_FORMAT.MONTH;
  }
  return DATE_FORMAT.YEAR;
};

export const formatRecordDate = (date: string | undefined): string => {
  if (!date) {
    return "";
  }
  // Medplum's formatDate reads a date in UTC. That keeps a calendar date as written, but moves a time of day to the wrong day in most time zones.
  if (date.includes(TIME_SEPARATOR)) {
    return formatDateTime(date, constant.LOCALE, DATE_FORMAT.DAY);
  }
  return formatDate(date, constant.LOCALE, selectCalendarDateFormat(date));
};
