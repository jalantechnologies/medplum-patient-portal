import { createContext, useContext } from "react";

import type { ImmunizationSearch, Nullable } from "../types";

type ImmunizationContextType = {
  immunizations: ImmunizationSearch;
};

export const ImmunizationContext =
  createContext<Nullable<ImmunizationContextType>>(null);

export const useImmunizationContext = (): ImmunizationContextType => {
  const immunizationContext = useContext(ImmunizationContext);
  if (!immunizationContext) {
    throw new Error(
      "useImmunizationContext must be used inside ImmunizationProvider",
    );
  }
  return immunizationContext;
};
