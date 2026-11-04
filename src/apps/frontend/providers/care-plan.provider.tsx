import { useMedplumContext } from "@medplum/react-hooks";
import { useMemo, type FC, type PropsWithChildren } from "react";

import { CarePlanContext } from "../contexts";
import { useAsynchronousResult } from "../hooks";
import { CarePlanService } from "../services";

export const CarePlanProvider: FC<PropsWithChildren> = ({ children }) => {
  const { medplum } = useMedplumContext();
  const carePlanService = useMemo(
    () => new CarePlanService(medplum),
    [medplum],
  );

  const {
    error: activeCarePlanCountError,
    isLoading: isActiveCarePlanCountLoading,
    load: countActiveCarePlans,
    result: activeCarePlanCount,
  } = useAsynchronousResult(carePlanService.countActiveCarePlans);

  const value = useMemo(
    () => ({
      activeCarePlanCount,
      activeCarePlanCountError,
      countActiveCarePlans,
      isActiveCarePlanCountLoading,
    }),
    [
      activeCarePlanCount,
      activeCarePlanCountError,
      countActiveCarePlans,
      isActiveCarePlanCountLoading,
    ],
  );

  return (
    <CarePlanContext.Provider value={value}>
      {children}
    </CarePlanContext.Provider>
  );
};
