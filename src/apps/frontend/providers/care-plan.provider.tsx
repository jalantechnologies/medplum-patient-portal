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

  const { error, hasAnswer, isRequesting, load, requestNumber, result } =
    useAsynchronousResult(carePlanService.countActiveCarePlans);

  const value = useMemo(
    () => ({
      activeCarePlanCountState: {
        error,
        hasAnswer,
        isRequesting,
        requestNumber,
        result,
      },
      countActiveCarePlans: load,
    }),
    [error, hasAnswer, isRequesting, load, requestNumber, result],
  );

  return (
    <CarePlanContext.Provider value={value}>
      {children}
    </CarePlanContext.Provider>
  );
};
