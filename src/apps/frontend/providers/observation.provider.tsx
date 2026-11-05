import { useMedplumContext } from "@medplum/react-hooks";
import { useMemo, type FC, type PropsWithChildren } from "react";

import { ObservationContext } from "../contexts";
import { useAsynchronousResult } from "../hooks";
import { ObservationService } from "../services";

export const ObservationProvider: FC<PropsWithChildren> = ({ children }) => {
  const { medplum } = useMedplumContext();
  const observationService = useMemo(
    () => new ObservationService(medplum),
    [medplum],
  );

  const {
    error: vitalSignPageError,
    isLoading: isVitalSignPageLoading,
    isRequesting: isVitalSignPageRequesting,
    load: listVitalSigns,
    result: vitalSignPage,
  } = useAsynchronousResult(observationService.listVitalSigns);

  const value = useMemo(
    () => ({
      isVitalSignPageLoading,
      isVitalSignPageRequesting,
      listVitalSigns,
      vitalSignPage,
      vitalSignPageError,
    }),
    [
      isVitalSignPageLoading,
      isVitalSignPageRequesting,
      listVitalSigns,
      vitalSignPage,
      vitalSignPageError,
    ],
  );

  return (
    <ObservationContext.Provider value={value}>
      {children}
    </ObservationContext.Provider>
  );
};
