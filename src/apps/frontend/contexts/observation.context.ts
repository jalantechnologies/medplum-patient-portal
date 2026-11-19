import { createContext, useContext } from "react";

import type { Nullable, VitalSignSearch } from "../types";

type ObservationContextType = {
  vitalSigns: VitalSignSearch;
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
