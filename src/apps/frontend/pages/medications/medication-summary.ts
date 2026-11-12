import {
  formatQuantity,
  formatRange,
  formatTiming,
  type WithId,
} from "@medplum/core";
import type {
  Dosage,
  DosageDoseAndRate,
  Medication,
  MedicationRequest,
  Resource,
  Timing,
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
const INSTRUCTION_PART_SEPARATOR = " · ";

const compareDosageSequence = (first: Dosage, second: Dosage) =>
  (first.sequence ?? SEQUENCE_WHEN_MISSING) -
  (second.sequence ?? SEQUENCE_WHEN_MISSING);

const formatDose = ({ doseQuantity, doseRange }: DosageDoseAndRate): string =>
  formatQuantity(doseQuantity) || formatRange(doseRange);

const describeDose = (doseAndRate: DosageDoseAndRate[] | undefined): string => {
  const dose = doseAndRate?.map(formatDose).find(Boolean);
  return dose ? `Dose: ${dose}` : "";
};

const describeTiming = (timing: Timing | undefined): string =>
  timing?.code?.text ||
  formatTiming(timing) ||
  nameCodeableConcept(timing?.code);

const describeAsNeeded = ({
  asNeededBoolean,
  asNeededCodeableConcept,
}: Dosage): string => {
  if (asNeededCodeableConcept) {
    const reason = nameCodeableConcept(asNeededCodeableConcept);
    return reason ? `As needed for ${reason}` : "As needed";
  }
  return asNeededBoolean ? "As needed" : "";
};

const describeCodedDosage = (dosage: Dosage): string =>
  [
    describeDose(dosage.doseAndRate),
    describeTiming(dosage.timing),
    describeAsNeeded(dosage),
  ]
    .filter(Boolean)
    .join(INSTRUCTION_PART_SEPARATOR);

const describeDosage = (dosage: Dosage): string[] => {
  const instruction =
    dosage.patientInstruction || dosage.text || describeCodedDosage(dosage);
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
