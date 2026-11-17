import type { WithId } from "@medplum/core";
import type { CarePlan } from "@medplum/fhirtypes";
import { createContext, useContext, useMemo } from "react";

import { useReader } from "../hooks";
import type {
  AsynchronousResultState,
  ListCarePlanPreviewParameters,
  Nullable,
} from "../types";

type CarePlanContextType = {
  activeCarePlanCountState: AsynchronousResultState<number>;
  carePlanPreviewState: AsynchronousResultState<WithId<CarePlan>[]>;
  countActiveCarePlans: (patientReference: string) => Promise<Nullable<number>>;
  listCarePlanPreview: (
    parameters: ListCarePlanPreviewParameters,
  ) => Promise<Nullable<WithId<CarePlan>[]>>;
};

export const CarePlanContext =
  createContext<Nullable<CarePlanContextType>>(null);

export const useCarePlanContext = () => {
  const carePlanContext = useContext(CarePlanContext);
  if (!carePlanContext) {
    throw new Error("useCarePlanContext must be used inside CarePlanProvider");
  }
  const {
    activeCarePlanCountState,
    carePlanPreviewState,
    countActiveCarePlans,
    listCarePlanPreview,
  } = carePlanContext;
  const activeCarePlanCountReader = useReader(activeCarePlanCountState);
  const carePlanPreviewReader = useReader(carePlanPreviewState);
  return useMemo(
    () => ({
      activeCarePlanCount: activeCarePlanCountReader.result,
      activeCarePlanCountError: activeCarePlanCountReader.error,
      carePlanPreview: carePlanPreviewReader.result,
      carePlanPreviewError: carePlanPreviewReader.error,
      countActiveCarePlans,
      hasCarePlanPreviewAnswer: carePlanPreviewReader.hasAnswer,
      isActiveCarePlanCountLoading: activeCarePlanCountReader.isLoading,
      isCarePlanPreviewLoading: carePlanPreviewReader.isLoading,
      listCarePlanPreview,
    }),
    [
      activeCarePlanCountReader.error,
      activeCarePlanCountReader.isLoading,
      activeCarePlanCountReader.result,
      carePlanPreviewReader.error,
      carePlanPreviewReader.hasAnswer,
      carePlanPreviewReader.isLoading,
      carePlanPreviewReader.result,
      countActiveCarePlans,
      listCarePlanPreview,
    ],
  );
};
