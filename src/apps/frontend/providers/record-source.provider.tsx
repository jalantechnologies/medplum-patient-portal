import { useMedplumContext } from "@medplum/react-hooks";
import { useMemo, type FC, type PropsWithChildren } from "react";

import { RecordSourceContext } from "../contexts";
import { useAsynchronousResultState } from "../hooks";
import { RecordSourceService } from "../services";

export const RecordSourceProvider: FC<PropsWithChildren> = ({ children }) => {
  const { medplum } = useMedplumContext();
  const recordSourceService = useMemo(
    () => new RecordSourceService(medplum),
    [medplum],
  );
  const { load: listRecordSourceNames, state: recordSourceNamesState } =
    useAsynchronousResultState(recordSourceService.listRecordSourceNames);
  const { load: findLastReceived, state: lastReceivedState } =
    useAsynchronousResultState(recordSourceService.findLastReceived);

  const value = useMemo(
    () => ({
      findLastReceived,
      lastReceivedState,
      listRecordSourceNames,
      recordSourceNamesState,
    }),
    [
      findLastReceived,
      lastReceivedState,
      listRecordSourceNames,
      recordSourceNamesState,
    ],
  );

  return (
    <RecordSourceContext.Provider value={value}>
      {children}
    </RecordSourceContext.Provider>
  );
};
