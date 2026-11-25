import {
  formatObservationValue,
  getCodeBySystem,
  type WithId,
} from "@medplum/core";
import type {
  AllergyIntolerance,
  Annotation,
  CodeableConcept,
  Condition,
  Observation,
} from "@medplum/fhirtypes";

import {
  ALLERGY_INTOLERANCE_CLINICAL_STATUS,
  ALLERGY_INTOLERANCE_VERIFICATION_STATUS,
  CODE_SYSTEM,
  CONDITION_CLINICAL_STATUS,
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

export interface HealthRecordNote {
  author: string;
  date: string;
  text: string;
}

export interface HealthRecordSummary {
  author: string;
  date: string;
  identifier: string;
  notes: HealthRecordNote[];
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
  endedClinicalCodes: string[];
  refutedCode: string;
  unconfirmedVerificationCodes: string[];
  verificationStatus: CodeableConcept | undefined;
  verificationSystem: string;
}

const RULED_OUT_STATUS = "Ruled out";
const UNCONFIRMED_STATUS = "Unconfirmed";

const ENDED_CONDITION_CODES: string[] = [
  CONDITION_CLINICAL_STATUS.INACTIVE,
  CONDITION_CLINICAL_STATUS.REMISSION,
  CONDITION_CLINICAL_STATUS.RESOLVED,
];

const UNCONFIRMED_CONDITION_CODES: string[] = [
  CONDITION_VERIFICATION_STATUS.DIFFERENTIAL,
  CONDITION_VERIFICATION_STATUS.PROVISIONAL,
  CONDITION_VERIFICATION_STATUS.UNCONFIRMED,
];

const ENDED_ALLERGY_INTOLERANCE_CODES: string[] = [
  ALLERGY_INTOLERANCE_CLINICAL_STATUS.INACTIVE,
  ALLERGY_INTOLERANCE_CLINICAL_STATUS.RESOLVED,
];

const UNCONFIRMED_ALLERGY_INTOLERANCE_CODES: string[] = [
  ALLERGY_INTOLERANCE_VERIFICATION_STATUS.UNCONFIRMED,
];

const summarizeNote = ({
  authorReference,
  authorString,
  text,
  time,
}: Annotation): HealthRecordNote => ({
  author: authorReference?.display ?? authorString ?? "",
  date: formatRecordDate(time),
  text,
});

const humanizeStatus = (
  status: CodeableConcept | undefined,
  system: string,
): string => humanizeCode(status && getCodeBySystem(status, system));

const describeClinicalRecordStatus = ({
  clinicalStatus,
  clinicalSystem,
  endedClinicalCodes,
  refutedCode,
  unconfirmedVerificationCodes,
  verificationStatus,
  verificationSystem,
}: ClinicalRecordStatus): string => {
  const verificationCode =
    verificationStatus &&
    getCodeBySystem(verificationStatus, verificationSystem);
  const clinicalCode =
    clinicalStatus && getCodeBySystem(clinicalStatus, clinicalSystem);
  if (verificationCode === refutedCode) {
    return RULED_OUT_STATUS;
  }
  const isUnconfirmed =
    verificationCode !== undefined &&
    unconfirmedVerificationCodes.includes(verificationCode);
  const hasEnded =
    clinicalCode !== undefined && endedClinicalCodes.includes(clinicalCode);
  return isUnconfirmed && !hasEnded
    ? UNCONFIRMED_STATUS
    : humanizeCode(clinicalCode);
};

export const summarizeCondition = (
  condition: WithId<Condition>,
  recordSourceNames: RecordSourceNames,
): HealthRecordSummary => ({
  author: condition.recorder?.display ?? "",
  date: formatRecordDate(condition.recordedDate),
  identifier: condition.id,
  notes: [],
  received: formatRecordDateTime(condition.meta?.lastUpdated),
  source: recordSourceNames.findName(condition.meta?.source),
  status: describeClinicalRecordStatus({
    clinicalStatus: condition.clinicalStatus,
    clinicalSystem: CODE_SYSTEM.CONDITION_CLINICAL,
    endedClinicalCodes: ENDED_CONDITION_CODES,
    refutedCode: CONDITION_VERIFICATION_STATUS.REFUTED,
    unconfirmedVerificationCodes: UNCONFIRMED_CONDITION_CODES,
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
  notes: allergyIntolerance.note?.map(summarizeNote) ?? [],
  received: formatRecordDateTime(allergyIntolerance.meta?.lastUpdated),
  source: recordSourceNames.findName(allergyIntolerance.meta?.source),
  status: describeClinicalRecordStatus({
    clinicalStatus: allergyIntolerance.clinicalStatus,
    clinicalSystem: CODE_SYSTEM.ALLERGY_INTOLERANCE_CLINICAL,
    endedClinicalCodes: ENDED_ALLERGY_INTOLERANCE_CODES,
    refutedCode: ALLERGY_INTOLERANCE_VERIFICATION_STATUS.REFUTED,
    unconfirmedVerificationCodes: UNCONFIRMED_ALLERGY_INTOLERANCE_CODES,
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
  notes: [],
  received: formatRecordDateTime(vitalSign.meta?.lastUpdated),
  source: recordSourceNames.findName(vitalSign.meta?.source),
  status: humanizeCode(vitalSign.status),
  title: nameCodeableConcept(vitalSign.code) || "Measurement",
  value: formatObservationValue(vitalSign),
  verification: "",
});
