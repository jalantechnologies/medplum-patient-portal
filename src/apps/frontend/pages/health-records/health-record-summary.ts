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
import type { RecordSourceNames } from "../../types";
import {
  formatRecordDate,
  formatRecordDateTime,
  humanizeCode,
  nameAllergyIntolerance,
  nameCodeableConcept,
} from "../../utilities";

export interface HealthRecordSummary {
  author: string;
  date: string;
  identifier: string;
  received: string;
  source: string;
  status: string;
  title: string;
  value: string;
  verification: string;
}

interface ClinicalRecordStatus {
  clinicalStatus: CodeableConcept | undefined;
  clinicalSystem: string;
  refutedCode: string;
  unconfirmedCode: string;
  verificationStatus: CodeableConcept | undefined;
  verificationSystem: string;
}

const RULED_OUT_STATUS = "Ruled out";
const UNCONFIRMED_STATUS = "Unconfirmed";

const humanizeStatus = (
  status: CodeableConcept | undefined,
  system: string,
): string => humanizeCode(status && getCodeBySystem(status, system));

const describeClinicalRecordStatus = ({
  clinicalStatus,
  clinicalSystem,
  refutedCode,
  unconfirmedCode,
  verificationStatus,
  verificationSystem,
}: ClinicalRecordStatus): string => {
  const verificationCode =
    verificationStatus &&
    getCodeBySystem(verificationStatus, verificationSystem);
  if (verificationCode === refutedCode) {
    return RULED_OUT_STATUS;
  }
  if (verificationCode === unconfirmedCode) {
    return UNCONFIRMED_STATUS;
  }
  return humanizeStatus(clinicalStatus, clinicalSystem);
};

export const summarizeCondition = (
  condition: WithId<Condition>,
  recordSourceNames: RecordSourceNames,
): HealthRecordSummary => ({
  author: condition.recorder?.display ?? "",
  date: formatRecordDate(condition.recordedDate),
  identifier: condition.id,
  received: formatRecordDateTime(condition.meta?.lastUpdated),
  source: recordSourceNames.findName(condition.meta?.source),
  status: describeClinicalRecordStatus({
    clinicalStatus: condition.clinicalStatus,
    clinicalSystem: CODE_SYSTEM.CONDITION_CLINICAL,
    refutedCode: CONDITION_VERIFICATION_STATUS.REFUTED,
    unconfirmedCode: CONDITION_VERIFICATION_STATUS.UNCONFIRMED,
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
  recordSourceNames: RecordSourceNames,
): HealthRecordSummary => ({
  author: allergyIntolerance.recorder?.display ?? "",
  date: formatRecordDate(allergyIntolerance.recordedDate),
  identifier: allergyIntolerance.id,
  received: formatRecordDateTime(allergyIntolerance.meta?.lastUpdated),
  source: recordSourceNames.findName(allergyIntolerance.meta?.source),
  status: describeClinicalRecordStatus({
    clinicalStatus: allergyIntolerance.clinicalStatus,
    clinicalSystem: CODE_SYSTEM.ALLERGY_INTOLERANCE_CLINICAL,
    refutedCode: ALLERGY_INTOLERANCE_VERIFICATION_STATUS.REFUTED,
    unconfirmedCode: ALLERGY_INTOLERANCE_VERIFICATION_STATUS.UNCONFIRMED,
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
  recordSourceNames: RecordSourceNames,
): HealthRecordSummary => ({
  author: vitalSign.performer?.[0]?.display ?? "",
  date: formatRecordDate(
    vitalSign.effectiveDateTime ??
      vitalSign.effectiveInstant ??
      vitalSign.effectivePeriod?.start,
  ),
  identifier: vitalSign.id,
  received: formatRecordDateTime(vitalSign.meta?.lastUpdated),
  source: recordSourceNames.findName(vitalSign.meta?.source),
  status: humanizeCode(vitalSign.status),
  title: nameCodeableConcept(vitalSign.code) || "Measurement",
  value: formatObservationValue(vitalSign),
  verification: "",
});
