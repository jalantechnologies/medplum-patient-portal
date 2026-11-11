import { useCallback, useRef, useState } from "react";

import type {
  AsynchronousOperationError,
  AsynchronousResult,
  Nullable,
} from "../types";
import useAsynchronous from "./asynchronous.hook";

interface AsynchronousResultState<Result> {
  error: Nullable<AsynchronousOperationError>;
  hasAnswer: boolean;
  isRequesting: boolean;
  result: Nullable<Result>;
}

interface UseAsynchronousResultResponse<
  Result,
  FunctionParameters extends unknown[],
> extends Omit<AsynchronousResultState<Result>, "hasAnswer"> {
  addReader: () => () => void;
  isLoading: boolean;
  load: (...parameters: FunctionParameters) => Promise<Nullable<Result>>;
}

const initialState = {
  error: null,
  hasAnswer: false,
  isRequesting: false,
  result: null,
};

const clearFailure = <Result>(
  previousState: AsynchronousResultState<Result>,
): AsynchronousResultState<Result> =>
  previousState.error === null
    ? previousState
    : { ...previousState, error: null };

const startRequesting = <Result>(
  previousState: AsynchronousResultState<Result>,
): AsynchronousResultState<Result> => ({
  ...previousState,
  error: null,
  isRequesting: true,
});

const useLatestRequest = () => {
  const latestRequestNumber = useRef(0);

  return useCallback(() => {
    latestRequestNumber.current += 1;
    const requestNumber = latestRequestNumber.current;
    return () => requestNumber === latestRequestNumber.current;
  }, []);
};

// A provider can outlive the pages that read it, and a failure shown again when a page comes back would be out of date.
const useReaders = (forgetFailure: () => void) => {
  const readerCount = useRef(0);
  const hasEveryReaderLeft = useRef(false);

  const addReader = useCallback(() => {
    readerCount.current += 1;
    hasEveryReaderLeft.current = false;
    let isRemoved = false;
    return () => {
      if (isRemoved) {
        return;
      }
      isRemoved = true;
      readerCount.current -= 1;
      if (readerCount.current === 0) {
        hasEveryReaderLeft.current = true;
        forgetFailure();
      }
    };
  }, [forgetFailure]);

  const failureToShow = useCallback(
    (error: AsynchronousOperationError) =>
      hasEveryReaderLeft.current ? null : error,
    [],
  );

  return { addReader, failureToShow };
};

const useAsynchronousResult = <Result, FunctionParameters extends unknown[]>(
  asynchronousFunction: (
    ...parameters: FunctionParameters
  ) => Promise<AsynchronousResult<Result>>,
): UseAsynchronousResultResponse<Result, FunctionParameters> => {
  const { asynchronousCallback } = useAsynchronous(asynchronousFunction);
  const [state, setState] =
    useState<AsynchronousResultState<Result>>(initialState);
  const startRequest = useLatestRequest();
  const forgetFailure = useCallback(() => setState(clearFailure), []);
  const { addReader, failureToShow } = useReaders(forgetFailure);

  const load = useCallback(
    async (...parameters: FunctionParameters) => {
      const isLatestRequest = startRequest();
      setState(startRequesting);
      try {
        const result = await asynchronousCallback(...parameters);
        if (isLatestRequest()) {
          setState({
            error: null,
            hasAnswer: true,
            isRequesting: false,
            result,
          });
        }
        return result;
      } catch (error) {
        if (isLatestRequest()) {
          const shownError = failureToShow(error as AsynchronousOperationError);
          setState((previousState) => ({
            ...previousState,
            error: shownError,
            isRequesting: false,
          }));
        }
        throw error;
      }
    },
    [asynchronousCallback, failureToShow, startRequest],
  );

  const { hasAnswer, ...shownState } = state;

  return {
    ...shownState,
    addReader,
    isLoading: !hasAnswer && shownState.error === null,
    load,
  };
};

export default useAsynchronousResult;
