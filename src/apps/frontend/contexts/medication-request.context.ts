import type { WithId } from "@medplum/core";
import type { MedicationRequest } from "@medplum/fhirtypes";
import { createContext, useContext } from "react";

import type {
  AsynchronousOperationError,
  Nullable,
  RecordSearch,
} from "../types";

type MedicationRequestContextType = {
  activePrescriptionCount: Nullable<number>;
  activePrescriptionCountError: Nullable<AsynchronousOperationError>;
  allMedicationRequests: RecordSearch<WithId<MedicationRequest>>;
  countActivePrescriptions: (
    patientReference: string,
  ) => Promise<Nullable<number>>;
  isActivePrescriptionCountLoading: boolean;
  pastMedicationRequests: RecordSearch<WithId<MedicationRequest>>;
};

export const MedicationRequestContext =
  createContext<Nullable<MedicationRequestContextType>>(null);

export const useMedicationRequestContext = (): MedicationRequestContextType => {
  const medicationRequestContext = useContext(MedicationRequestContext);
  if (!medicationRequestContext) {
    throw new Error(
      "useMedicationRequestContext must be used inside MedicationRequestProvider",
    );
  }
  return medicationRequestContext;
};
