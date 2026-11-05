import { useMedplumContext } from "@medplum/react-hooks";
import { useMemo, type FC, type PropsWithChildren } from "react";

import { AllergyIntoleranceContext } from "../contexts";
import { useAsynchronousResult } from "../hooks";
import { AllergyIntoleranceService } from "../services";

export const AllergyIntoleranceProvider: FC<PropsWithChildren> = ({
  children,
}) => {
  const { medplum } = useMedplumContext();
  const allergyIntoleranceService = useMemo(
    () => new AllergyIntoleranceService(medplum),
    [medplum],
  );

  const {
    error: allergyIntolerancePageError,
    isLoading: isAllergyIntolerancePageLoading,
    isRequesting: isAllergyIntolerancePageRequesting,
    load: listAllergyIntolerances,
    result: allergyIntolerancePage,
  } = useAsynchronousResult(allergyIntoleranceService.listAllergyIntolerances);

  const value = useMemo(
    () => ({
      allergyIntolerancePage,
      allergyIntolerancePageError,
      isAllergyIntolerancePageLoading,
      isAllergyIntolerancePageRequesting,
      listAllergyIntolerances,
    }),
    [
      allergyIntolerancePage,
      allergyIntolerancePageError,
      isAllergyIntolerancePageLoading,
      isAllergyIntolerancePageRequesting,
      listAllergyIntolerances,
    ],
  );

  return (
    <AllergyIntoleranceContext.Provider value={value}>
      {children}
    </AllergyIntoleranceContext.Provider>
  );
};
