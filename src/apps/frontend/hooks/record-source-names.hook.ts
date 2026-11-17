import { useCallback, useEffect } from "react";

import {
  RecordSourceNames,
  type AsynchronousOperationError,
  type ListRecordSourcesParameters,
  type Nullable,
  type RetryableRequest,
} from "../types";

interface RecordSourceNamesSource {
  listRecordSourceNames: (
    parameters: ListRecordSourcesParameters,
  ) => Promise<unknown>;
  patientReference: string | undefined;
  recordSourceNames: Nullable<RecordSourceNames>;
  recordSourceNamesError: Nullable<AsynchronousOperationError>;
}

const NO_RECORD_SOURCE_NAMES = new RecordSourceNames();

const useRecordSourceNames = ({
  listRecordSourceNames,
  patientReference,
  recordSourceNames,
  recordSourceNamesError,
}: RecordSourceNamesSource) => {
  const listNames = useCallback(async () => {
    if (patientReference) {
      await Promise.allSettled([listRecordSourceNames({ patientReference })]);
    }
  }, [listRecordSourceNames, patientReference]);

  useEffect(() => {
    void listNames();
  }, [listNames]);

  const recordSourceRequest: RetryableRequest = {
    error: recordSourceNamesError,
    retry: listNames,
  };

  return {
    recordSourceNames: recordSourceNames ?? NO_RECORD_SOURCE_NAMES,
    recordSourceRequest,
  };
};

export default useRecordSourceNames;
