import { useMedplumContext } from "@medplum/react-hooks";
import { useMemo, type FC, type PropsWithChildren } from "react";

import { CarePlanContext } from "../contexts";
import { useAsynchronousResultState } from "../hooks";
import { CarePlanService } from "../services";

export const CarePlanProvider: FC<PropsWithChildren> = ({ children }) => {
  const { medplum } = useMedplumContext();
  const carePlanService = useMemo(
    () => new CarePlanService(medplum),
    [medplum],
  );
  const { load: countActiveCarePlans, state: activeCarePlanCountState } =
    useAsynchronousResultState(carePlanService.countActiveCarePlans);
  const { load: listCarePlanPreview, state: carePlanPreviewState } =
    useAsynchronousResultState(carePlanService.listCarePlanPreview);

  const value = useMemo(
    () => ({
      activeCarePlanCountState,
      carePlanPreviewState,
      countActiveCarePlans,
      listCarePlanPreview,
    }),
    [
      activeCarePlanCountState,
      carePlanPreviewState,
      countActiveCarePlans,
      listCarePlanPreview,
    ],
  );

  return (
    <CarePlanContext.Provider value={value}>
      {children}
    </CarePlanContext.Provider>
  );
};
