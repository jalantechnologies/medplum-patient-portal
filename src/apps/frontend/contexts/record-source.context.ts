import { createContext, useContext, useMemo } from "react";

import { useReader } from "../hooks";
import type {
  AsynchronousResultState,
  FindLastReceivedParameters,
  ListedRecordSourceNames,
  ListRecordSourcesParameters,
  Nullable,
} from "../types";

type RecordSourceContextType = {
  findLastReceived: (
    parameters: FindLastReceivedParameters,
  ) => Promise<Nullable<string>>;
  lastReceivedState: AsynchronousResultState<string>;
  listRecordSourceNames: (
    parameters: ListRecordSourcesParameters,
  ) => Promise<Nullable<ListedRecordSourceNames>>;
  recordSourceNamesState: AsynchronousResultState<ListedRecordSourceNames>;
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
  const {
    findLastReceived,
    lastReceivedState,
    listRecordSourceNames,
    recordSourceNamesState,
  } = recordSourceContext;
  const { error, hasAnswer, isLoading, result } = useReader(
    recordSourceNamesState,
  );
  const lastReceivedReader = useReader(lastReceivedState);
  return useMemo(
    () => ({
      findLastReceived,
      hasLastReceivedAnswer: lastReceivedReader.hasAnswer,
      hasRecordSourceNamesAnswer: hasAnswer,
      isLastReceivedLoading: lastReceivedReader.isLoading,
      isRecordSourceNamesLoading: isLoading,
      lastReceived: lastReceivedReader.result,
      lastReceivedError: lastReceivedReader.error,
      listRecordSourceNames,
      recordSourceNames: result,
      recordSourceNamesError: error,
    }),
    [
      error,
      findLastReceived,
      hasAnswer,
      isLoading,
      lastReceivedReader.error,
      lastReceivedReader.hasAnswer,
      lastReceivedReader.isLoading,
      lastReceivedReader.result,
      listRecordSourceNames,
      result,
    ],
  );
};
