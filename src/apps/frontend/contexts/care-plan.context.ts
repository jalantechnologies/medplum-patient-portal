import { createContext, useContext, useMemo } from "react";

import { useReader } from "../hooks";
import type { AsynchronousResultState, Nullable } from "../types";

type CarePlanContextType = {
  activeCarePlanCountState: AsynchronousResultState<number>;
  countActiveCarePlans: (patientReference: string) => Promise<Nullable<number>>;
};

export const CarePlanContext =
  createContext<Nullable<CarePlanContextType>>(null);

export const useCarePlanContext = () => {
  const carePlanContext = useContext(CarePlanContext);
  if (!carePlanContext) {
    throw new Error("useCarePlanContext must be used inside CarePlanProvider");
  }
  const { activeCarePlanCountState, countActiveCarePlans } = carePlanContext;
  const { error, isLoading, result } = useReader(activeCarePlanCountState);
  return useMemo(
    () => ({
      activeCarePlanCount: result,
      activeCarePlanCountError: error,
      countActiveCarePlans,
      isActiveCarePlanCountLoading: isLoading,
    }),
    [countActiveCarePlans, error, isLoading, result],
  );
};
