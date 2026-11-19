import { useMedplumContext } from "@medplum/react-hooks";
import { useMemo, type FC, type PropsWithChildren } from "react";

import { ConditionContext } from "../contexts";
import { useRecordSearch } from "../hooks";
import { ConditionService } from "../services";
import type { ConditionSearch } from "../types";

export const ConditionProvider: FC<PropsWithChildren> = ({ children }) => {
  const { medplum } = useMedplumContext();
  const conditionService = useMemo(
    () => new ConditionService(medplum),
    [medplum],
  );
  const conditions: ConditionSearch = useRecordSearch(
    conditionService.listConditions,
  );

  const value = useMemo(() => ({ conditions }), [conditions]);

  return (
    <ConditionContext.Provider value={value}>
      {children}
    </ConditionContext.Provider>
  );
};
