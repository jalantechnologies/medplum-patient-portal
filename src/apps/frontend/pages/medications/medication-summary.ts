import {
  formatQuantity,
  formatRange,
  formatTiming,
  type WithId,
} from "@medplum/core";
import type {
  Dosage,
  DosageDoseAndRate,
  MedicationRequest,
  Timing,
} from "@medplum/fhirtypes";

import {
  PrescribedMedicine,
  type MedicationRequestPage,
  type RecordSourceNames,
} from "../../types";
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
  received: string;
  source: string;
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

export const summarizeMedicationRequest = (
  medicationRequest: WithId<MedicationRequest>,
  { medications }: MedicationRequestPage,
  recordSourceNames: RecordSourceNames,
): MedicationSummary => ({
  date: formatRecordDate(medicationRequest.authoredOn),
  identifier: medicationRequest.id,
  instructions: [...(medicationRequest.dosageInstruction ?? [])]
    .sort(compareDosageSequence)
    .flatMap(describeDosage),
  isDoNotPerform: medicationRequest.doNotPerform ?? false,
  prescriber: medicationRequest.requester?.display ?? "",
  received: formatRecordDate(medicationRequest.meta?.lastUpdated),
  source: recordSourceNames.findName(medicationRequest.meta?.source),
  status: humanizeCode(medicationRequest.status),
  title:
    new PrescribedMedicine(medicationRequest, medications).names.at(0) ??
    "Medication",
});
