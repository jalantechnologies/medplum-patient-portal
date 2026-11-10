import {
  capitalize,
  formatDate,
  formatDateTime,
  formatObservationValue,
  getCodeBySystem,
  type WithId,
} from "@medplum/core";
import type {
  AllergyIntolerance,
  CodeableConcept,
  Condition,
  Observation,
} from "@medplum/fhirtypes";

import constant from "../../constants";
import { DATE_FORMAT } from "../../constants/date-format";
import { CODE_SYSTEM } from "../../constants/fhir";

export interface HealthRecordSummary {
  author: string;
  date: string;
  identifier: string;
  status: string;
  title: string;
  value: string;
  verification: string;
}

const CODE_WORD_SEPARATOR = "-";
const DATE_PART_SEPARATOR = "-";
const TIME_SEPARATOR = "T";

const humanizeCode = (code: string | undefined): string =>
  code ? capitalize(code.replaceAll(CODE_WORD_SEPARATOR, " ")) : "";

const nameCodeableConcept = (concept: CodeableConcept | undefined): string =>
  concept?.text ||
  concept?.coding?.find(({ display }) => display)?.display ||
  "";

const humanizeStatus = (
  status: CodeableConcept | undefined,
  system: string,
): string => humanizeCode(status && getCodeBySystem(status, system));

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

const formatRecordDate = (date: string | undefined): string => {
  if (!date) {
    return "";
  }
  // Medplum's formatDate reads a date in UTC. That keeps a calendar date as written, but moves a time of day to the wrong day in most time zones.
  if (date.includes(TIME_SEPARATOR)) {
    return formatDateTime(date, constant.LOCALE, DATE_FORMAT.DAY);
  }
  return formatDate(date, constant.LOCALE, selectCalendarDateFormat(date));
};

export const summarizeCondition = (
  condition: WithId<Condition>,
): HealthRecordSummary => ({
  author: condition.recorder?.display ?? "",
  date: formatRecordDate(condition.recordedDate),
  identifier: condition.id,
  status: humanizeStatus(
    condition.clinicalStatus,
    CODE_SYSTEM.CONDITION_CLINICAL,
  ),
  title: nameCodeableConcept(condition.code) || "Condition",
  value: "",
  verification: humanizeStatus(
    condition.verificationStatus,
    CODE_SYSTEM.CONDITION_VERIFICATION,
  ),
});

export const summarizeAllergyIntolerance = (
  allergyIntolerance: WithId<AllergyIntolerance>,
): HealthRecordSummary => ({
  author: allergyIntolerance.recorder?.display ?? "",
  date: formatRecordDate(allergyIntolerance.recordedDate),
  identifier: allergyIntolerance.id,
  status: humanizeStatus(
    allergyIntolerance.clinicalStatus,
    CODE_SYSTEM.ALLERGY_INTOLERANCE_CLINICAL,
  ),
  title: nameCodeableConcept(allergyIntolerance.code) || "Allergy",
  value: "",
  verification: humanizeStatus(
    allergyIntolerance.verificationStatus,
    CODE_SYSTEM.ALLERGY_INTOLERANCE_VERIFICATION,
  ),
});

export const summarizeVitalSign = (
  vitalSign: WithId<Observation>,
): HealthRecordSummary => ({
  author: vitalSign.performer?.[0]?.display ?? "",
  date: formatRecordDate(
    vitalSign.effectiveDateTime ??
      vitalSign.effectiveInstant ??
      vitalSign.effectivePeriod?.start,
  ),
  identifier: vitalSign.id,
  status: humanizeCode(vitalSign.status),
  title: nameCodeableConcept(vitalSign.code) || "Measurement",
  value: formatObservationValue(vitalSign),
  verification: "",
});
