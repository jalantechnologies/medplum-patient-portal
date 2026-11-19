import { useMedplumContext } from "@medplum/react-hooks";
import { useMemo, type FC, type PropsWithChildren } from "react";

import { ObservationContext } from "../contexts";
import { useRecordSearch } from "../hooks";
import { ObservationService } from "../services";
import type { VitalSignSearch } from "../types";

export const ObservationProvider: FC<PropsWithChildren> = ({ children }) => {
  const { medplum } = useMedplumContext();
  const observationService = useMemo(
    () => new ObservationService(medplum),
    [medplum],
  );
  const vitalSigns: VitalSignSearch = useRecordSearch(
    observationService.listVitalSigns,
  );

  const value = useMemo(() => ({ vitalSigns }), [vitalSigns]);

  return (
    <ObservationContext.Provider value={value}>
      {children}
    </ObservationContext.Provider>
  );
};
