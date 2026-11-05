import type { WithId } from "@medplum/core";
import type { Condition } from "@medplum/fhirtypes";
import { createContext, useContext } from "react";

import type {
  AsynchronousOperationError,
  Nullable,
  SearchPage,
} from "../types";

type ConditionContextType = {
  conditionPage: Nullable<SearchPage<WithId<Condition>>>;
  conditionPageError: Nullable<AsynchronousOperationError>;
  isConditionPageLoading: boolean;
  isConditionPageRequesting: boolean;
  listConditions: (
    patientReference: string,
    previousPage?: Nullable<SearchPage<WithId<Condition>>>,
  ) => Promise<Nullable<SearchPage<WithId<Condition>>>>;
};

export const ConditionContext =
  createContext<Nullable<ConditionContextType>>(null);

export const useConditionContext = (): ConditionContextType => {
  const conditionContext = useContext(ConditionContext);
  if (!conditionContext) {
    throw new Error(
      "useConditionContext must be used inside ConditionProvider",
    );
  }
  return conditionContext;
};
