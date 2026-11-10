import {
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

import { CODE_SYSTEM } from "../../constants/fhir";
import {
  formatRecordDate,
  humanizeCode,
  nameCodeableConcept,
} from "../../utilities";

export interface HealthRecordSummary {
  author: string;
  date: string;
  identifier: string;
  status: string;
  title: string;
  value: string;
  verification: string;
}

const humanizeStatus = (
  status: CodeableConcept | undefined,
  system: string,
): string => humanizeCode(status && getCodeBySystem(status, system));

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
