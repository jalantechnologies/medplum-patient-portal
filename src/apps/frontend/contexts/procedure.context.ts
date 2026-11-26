import { createContext, useContext } from "react";

import type { Nullable, ProcedureSearch } from "../types";

type ProcedureContextType = {
  procedures: ProcedureSearch;
};

export const ProcedureContext =
  createContext<Nullable<ProcedureContextType>>(null);

export const useProcedureContext = (): ProcedureContextType => {
  const procedureContext = useContext(ProcedureContext);
  if (!procedureContext) {
    throw new Error(
      "useProcedureContext must be used inside ProcedureProvider",
    );
  }
  return procedureContext;
};
