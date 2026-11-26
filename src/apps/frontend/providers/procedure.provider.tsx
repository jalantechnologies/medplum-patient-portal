import { useMedplumContext } from "@medplum/react-hooks";
import { useMemo, type FC, type PropsWithChildren } from "react";

import { ProcedureContext } from "../contexts";
import { useRecordSearch } from "../hooks";
import { ProcedureService } from "../services";
import type { ProcedureSearch } from "../types";

export const ProcedureProvider: FC<PropsWithChildren> = ({ children }) => {
  const { medplum } = useMedplumContext();
  const procedureService = useMemo(
    () => new ProcedureService(medplum),
    [medplum],
  );
  const procedures: ProcedureSearch = useRecordSearch(
    procedureService.listProcedures,
  );

  const value = useMemo(() => ({ procedures }), [procedures]);

  return (
    <ProcedureContext.Provider value={value}>
      {children}
    </ProcedureContext.Provider>
  );
};
