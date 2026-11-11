import { useCallback, useRef, useState } from "react";

import type {
  AsynchronousOperationError,
  AsynchronousResult,
  AsynchronousResultState,
  Nullable,
} from "../types";
import useAsynchronous from "./asynchronous.hook";

interface UseAsynchronousResultResponse<
  Result,
  FunctionParameters extends unknown[],
> extends AsynchronousResultState<Result> {
  isLoading: boolean;
  load: (...parameters: FunctionParameters) => Promise<Nullable<Result>>;
}

const initialState = {
  error: null,
  hasAnswer: false,
  isRequesting: false,
  requestNumber: 0,
  result: null,
};

export const isLoadingResult = ({
  error,
  hasAnswer,
}: Pick<AsynchronousResultState<unknown>, "error" | "hasAnswer">) =>
  !hasAnswer && error === null;

const startRequesting =
  (requestNumber: number) =>
  <Result>(
    previousState: AsynchronousResultState<Result>,
  ): AsynchronousResultState<Result> => ({
    ...previousState,
    error: null,
    isRequesting: true,
    requestNumber,
  });

const useLatestRequest = () => {
  const latestRequestNumber = useRef(0);

  return useCallback(() => {
    latestRequestNumber.current += 1;
    const requestNumber = latestRequestNumber.current;
    return {
      isLatestRequest: () => requestNumber === latestRequestNumber.current,
      requestNumber,
    };
  }, []);
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

  const load = useCallback(
    async (...parameters: FunctionParameters) => {
      const { isLatestRequest, requestNumber } = startRequest();
      setState(startRequesting(requestNumber));
      try {
        const result = await asynchronousCallback(...parameters);
        if (isLatestRequest()) {
          setState({
            error: null,
            hasAnswer: true,
            isRequesting: false,
            requestNumber,
            result,
          });
        }
        return result;
      } catch (error) {
        if (isLatestRequest()) {
          setState((previousState) => ({
            ...previousState,
            error: error as AsynchronousOperationError,
            isRequesting: false,
          }));
        }
        throw error;
      }
    },
    [asynchronousCallback, startRequest],
  );

  return {
    ...state,
    isLoading: isLoadingResult(state),
    load,
  };
};

export default useAsynchronousResult;
