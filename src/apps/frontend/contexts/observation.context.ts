import type { WithId } from "@medplum/core";
import type { Observation } from "@medplum/fhirtypes";
import { createContext, useContext } from "react";

import type {
  AsynchronousOperationError,
  Nullable,
  SearchPage,
} from "../types";

type ObservationContextType = {
  isVitalSignPageLoading: boolean;
  isVitalSignPageRequesting: boolean;
  listVitalSigns: (
    patientReference: string,
    previousPage?: Nullable<SearchPage<WithId<Observation>>>,
  ) => Promise<Nullable<SearchPage<WithId<Observation>>>>;
  vitalSignPage: Nullable<SearchPage<WithId<Observation>>>;
  vitalSignPageError: Nullable<AsynchronousOperationError>;
};

export const ObservationContext =
  createContext<Nullable<ObservationContextType>>(null);

export const useObservationContext = (): ObservationContextType => {
  const observationContext = useContext(ObservationContext);
  if (!observationContext) {
    throw new Error(
      "useObservationContext must be used inside ObservationProvider",
    );
  }
  return observationContext;
};
