import { useMedplumContext } from "@medplum/react-hooks";
import { useMemo, type FC, type PropsWithChildren } from "react";

import { ImmunizationContext } from "../contexts";
import { useRecordSearch } from "../hooks";
import { ImmunizationService } from "../services";
import type { ImmunizationSearch } from "../types";

export const ImmunizationProvider: FC<PropsWithChildren> = ({ children }) => {
  const { medplum } = useMedplumContext();
  const immunizationService = useMemo(
    () => new ImmunizationService(medplum),
    [medplum],
  );
  const immunizations: ImmunizationSearch = useRecordSearch(
    immunizationService.listImmunizations,
  );

  const value = useMemo(() => ({ immunizations }), [immunizations]);

  return (
    <ImmunizationContext.Provider value={value}>
      {children}
    </ImmunizationContext.Provider>
  );
};
