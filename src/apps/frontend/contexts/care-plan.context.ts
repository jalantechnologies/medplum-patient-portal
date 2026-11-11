import { createContext, useContext } from "react";

import { useReader } from "../hooks";
import type { AsynchronousOperationError, Nullable } from "../types";

type CarePlanContextType = {
  activeCarePlanCount: Nullable<number>;
  activeCarePlanCountError: Nullable<AsynchronousOperationError>;
  addActiveCarePlanCountReader: () => () => void;
  countActiveCarePlans: (patientReference: string) => Promise<Nullable<number>>;
  isActiveCarePlanCountLoading: boolean;
};

export const CarePlanContext =
  createContext<Nullable<CarePlanContextType>>(null);

export const useCarePlanContext = (): CarePlanContextType => {
  const carePlanContext = useContext(CarePlanContext);
  if (!carePlanContext) {
    throw new Error("useCarePlanContext must be used inside CarePlanProvider");
  }
  useReader(carePlanContext.addActiveCarePlanCountReader);
  return carePlanContext;
};
