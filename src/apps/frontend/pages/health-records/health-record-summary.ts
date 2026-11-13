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

import {
  ALLERGY_INTOLERANCE_VERIFICATION_STATUS,
  CODE_SYSTEM,
  CONDITION_VERIFICATION_STATUS,
} from "../../constants/fhir";
import {
  formatRecordDate,
  humanizeCode,
  nameAllergyIntolerance,
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

interface ClinicalRecordStatus {
  clinicalStatus: CodeableConcept | undefined;
  clinicalSystem: string;
  refutedCode: string;
  verificationStatus: CodeableConcept | undefined;
  verificationSystem: string;
}

const RULED_OUT_STATUS = "Ruled out";

const humanizeStatus = (
  status: CodeableConcept | undefined,
  system: string,
): string => humanizeCode(status && getCodeBySystem(status, system));

const describeClinicalRecordStatus = ({
  clinicalStatus,
  clinicalSystem,
  refutedCode,
  verificationStatus,
  verificationSystem,
}: ClinicalRecordStatus): string =>
  verificationStatus &&
  getCodeBySystem(verificationStatus, verificationSystem) === refutedCode
    ? RULED_OUT_STATUS
    : humanizeStatus(clinicalStatus, clinicalSystem);

export const summarizeCondition = (
  condition: WithId<Condition>,
): HealthRecordSummary => ({
  author: condition.recorder?.display ?? "",
  date: formatRecordDate(condition.recordedDate),
  identifier: condition.id,
  status: describeClinicalRecordStatus({
    clinicalStatus: condition.clinicalStatus,
    clinicalSystem: CODE_SYSTEM.CONDITION_CLINICAL,
    refutedCode: CONDITION_VERIFICATION_STATUS.REFUTED,
    verificationStatus: condition.verificationStatus,
    verificationSystem: CODE_SYSTEM.CONDITION_VERIFICATION,
  }),
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
  status: describeClinicalRecordStatus({
    clinicalStatus: allergyIntolerance.clinicalStatus,
    clinicalSystem: CODE_SYSTEM.ALLERGY_INTOLERANCE_CLINICAL,
    refutedCode: ALLERGY_INTOLERANCE_VERIFICATION_STATUS.REFUTED,
    verificationStatus: allergyIntolerance.verificationStatus,
    verificationSystem: CODE_SYSTEM.ALLERGY_INTOLERANCE_VERIFICATION,
  }),
  title: nameAllergyIntolerance(allergyIntolerance),
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
