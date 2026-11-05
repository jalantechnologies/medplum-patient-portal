import { useMedplumContext } from "@medplum/react-hooks";
import { useMemo, type FC, type PropsWithChildren } from "react";

import { ConditionContext } from "../contexts";
import { useAsynchronousResult } from "../hooks";
import { ConditionService } from "../services";

export const ConditionProvider: FC<PropsWithChildren> = ({ children }) => {
  const { medplum } = useMedplumContext();
  const conditionService = useMemo(
    () => new ConditionService(medplum),
    [medplum],
  );

  const {
    error: conditionPageError,
    isLoading: isConditionPageLoading,
    isRequesting: isConditionPageRequesting,
    load: listConditions,
    result: conditionPage,
  } = useAsynchronousResult(conditionService.listConditions);

  const value = useMemo(
    () => ({
      conditionPage,
      conditionPageError,
      isConditionPageLoading,
      isConditionPageRequesting,
      listConditions,
    }),
    [
      conditionPage,
      conditionPageError,
      isConditionPageLoading,
      isConditionPageRequesting,
      listConditions,
    ],
  );

  return (
    <ConditionContext.Provider value={value}>
      {children}
    </ConditionContext.Provider>
  );
};
