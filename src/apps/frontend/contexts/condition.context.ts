import { createContext, useContext } from "react";

import type { ConditionSearch, Nullable } from "../types";

type ConditionContextType = {
  conditions: ConditionSearch;
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
