import { useMedplumContext } from "@medplum/react-hooks";
import { useMemo, type FC, type PropsWithChildren } from "react";

import { AllergyIntoleranceContext } from "../contexts";
import { useAsynchronousResult, useRecordSearch } from "../hooks";
import { AllergyIntoleranceService } from "../services";
import type { AllergyIntoleranceSearch } from "../types";

export const AllergyIntoleranceProvider: FC<PropsWithChildren> = ({
  children,
}) => {
  const { medplum } = useMedplumContext();
  const allergyIntoleranceService = useMemo(
    () => new AllergyIntoleranceService(medplum),
    [medplum],
  );

  const allergyIntolerances: AllergyIntoleranceSearch = useRecordSearch(
    allergyIntoleranceService.listAllergyIntolerances,
  );

  const {
    error: activeAllergyIntolerancePreviewError,
    isLoading: isActiveAllergyIntolerancePreviewLoading,
    load: previewActiveAllergyIntolerances,
    result: activeAllergyIntolerancePreview,
  } = useAsynchronousResult(
    allergyIntoleranceService.previewActiveAllergyIntolerances,
  );

  const value = useMemo(
    () => ({
      activeAllergyIntolerancePreview,
      activeAllergyIntolerancePreviewError,
      allergyIntolerances,
      isActiveAllergyIntolerancePreviewLoading,
      previewActiveAllergyIntolerances,
    }),
    [
      activeAllergyIntolerancePreview,
      activeAllergyIntolerancePreviewError,
      allergyIntolerances,
      isActiveAllergyIntolerancePreviewLoading,
      previewActiveAllergyIntolerances,
    ],
  );

  return (
    <AllergyIntoleranceContext.Provider value={value}>
      {children}
    </AllergyIntoleranceContext.Provider>
  );
};
