import { formatTiming, type WithId } from "@medplum/core";
import type {
  Dosage,
  Medication,
  MedicationRequest,
  Resource,
} from "@medplum/fhirtypes";

import {
  CONTAINED_REFERENCE_PREFIX,
  RESOURCE_TYPE,
} from "../../constants/fhir";
import {
  formatRecordDate,
  humanizeCode,
  nameCodeableConcept,
} from "../../utilities";

export interface MedicationSummary {
  date: string;
  identifier: string;
  instructions: string[];
  isDoNotPerform: boolean;
  prescriber: string;
  status: string;
  title: string;
}

const SEQUENCE_WHEN_MISSING = Number.MAX_SAFE_INTEGER;

const compareDosageSequence = (first: Dosage, second: Dosage) =>
  (first.sequence ?? SEQUENCE_WHEN_MISSING) -
  (second.sequence ?? SEQUENCE_WHEN_MISSING);

const describeDosage = ({
  patientInstruction,
  text,
  timing,
}: Dosage): string[] => {
  const instruction = patientInstruction || text || formatTiming(timing);
  return instruction ? [instruction] : [];
};

const isMedication = (resource: Resource): resource is Medication =>
  resource.resourceType === RESOURCE_TYPE.MEDICATION;

const findContainedMedication = ({
  contained,
  medicationReference,
}: MedicationRequest) =>
  contained
    ?.filter(isMedication)
    .find(
      ({ id }) =>
        `${CONTAINED_REFERENCE_PREFIX}${id}` === medicationReference?.reference,
    );

const nameMedication = (medicationRequest: MedicationRequest): string =>
  nameCodeableConcept(medicationRequest.medicationCodeableConcept) ||
  medicationRequest.medicationReference?.display ||
  nameCodeableConcept(findContainedMedication(medicationRequest)?.code) ||
  "Medication";

export const summarizeMedicationRequest = (
  medicationRequest: WithId<MedicationRequest>,
): MedicationSummary => ({
  date: formatRecordDate(medicationRequest.authoredOn),
  identifier: medicationRequest.id,
  instructions: (medicationRequest.dosageInstruction ?? [])
    .toSorted(compareDosageSequence)
    .flatMap(describeDosage),
  isDoNotPerform: medicationRequest.doNotPerform ?? false,
  prescriber: medicationRequest.requester?.display ?? "",
  status: humanizeCode(medicationRequest.status),
  title: nameMedication(medicationRequest),
});
