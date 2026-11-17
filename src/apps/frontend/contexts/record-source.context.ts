import { createContext, useContext, useMemo } from "react";

import { useReader } from "../hooks";
import type {
  AsynchronousResultState,
  ListRecordSourcesParameters,
  Nullable,
  RecordSourceNames,
} from "../types";

type RecordSourceContextType = {
  listRecordSourceNames: (
    parameters: ListRecordSourcesParameters,
  ) => Promise<Nullable<RecordSourceNames>>;
  recordSourceNamesState: AsynchronousResultState<RecordSourceNames>;
};

export const RecordSourceContext =
  createContext<Nullable<RecordSourceContextType>>(null);

export const useRecordSourceContext = () => {
  const recordSourceContext = useContext(RecordSourceContext);
  if (!recordSourceContext) {
    throw new Error(
      "useRecordSourceContext must be used inside RecordSourceProvider",
    );
  }
  const { listRecordSourceNames, recordSourceNamesState } = recordSourceContext;
  const { error, result } = useReader(recordSourceNamesState);
  return useMemo(
    () => ({
      listRecordSourceNames,
      recordSourceNames: result,
      recordSourceNamesError: error,
    }),
    [error, listRecordSourceNames, result],
  );
};
