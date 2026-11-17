import { useMedplumContext } from "@medplum/react-hooks";
import { useMemo, type FC, type PropsWithChildren } from "react";

import { RecordSourceContext } from "../contexts";
import { useAsynchronousResult } from "../hooks";
import { RecordSourceService } from "../services";

export const RecordSourceProvider: FC<PropsWithChildren> = ({ children }) => {
  const { medplum } = useMedplumContext();
  const recordSourceService = useMemo(
    () => new RecordSourceService(medplum),
    [medplum],
  );

  const { error, hasAnswer, isRequesting, load, requestNumber, result } =
    useAsynchronousResult(recordSourceService.listRecordSourceNames);

  const value = useMemo(
    () => ({
      listRecordSourceNames: load,
      recordSourceNamesState: {
        error,
        hasAnswer,
        isRequesting,
        requestNumber,
        result,
      },
    }),
    [error, hasAnswer, isRequesting, load, requestNumber, result],
  );

  return (
    <RecordSourceContext.Provider value={value}>
      {children}
    </RecordSourceContext.Provider>
  );
};
