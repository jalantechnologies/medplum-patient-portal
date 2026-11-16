import { createContext, useContext } from "react";

import type {
  AsynchronousOperationError,
  MedicationRequestSearch,
  Nullable,
} from "../types";

type MedicationRequestContextType = {
  activePrescriptionCount: Nullable<number>;
  activePrescriptionCountError: Nullable<AsynchronousOperationError>;
  allMedicationRequests: MedicationRequestSearch;
  countActivePrescriptions: (
    patientReference: string,
  ) => Promise<Nullable<number>>;
  isActivePrescriptionCountLoading: boolean;
  pastMedicationRequests: MedicationRequestSearch;
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
