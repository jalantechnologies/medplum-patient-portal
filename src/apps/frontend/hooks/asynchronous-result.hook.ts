import { useCallback, useRef, useState } from "react";

import type {
  AsynchronousOperationError,
  AsynchronousResult,
  Nullable,
} from "../types";
import useAsynchronous from "./asynchronous.hook";

interface AsynchronousResultState<Result> {
  error: Nullable<AsynchronousOperationError>;
  isLoading: boolean;
  isRequesting: boolean;
  result: Nullable<Result>;
}

interface UseAsynchronousResultResponse<
  Result,
  FunctionParameters extends unknown[],
> extends AsynchronousResultState<Result> {
  load: (...parameters: FunctionParameters) => Promise<Nullable<Result>>;
}

const initialState = {
  error: null,
  isLoading: true,
  isRequesting: false,
  result: null,
};

const useAsynchronousResult = <Result, FunctionParameters extends unknown[]>(
  asynchronousFunction: (
    ...parameters: FunctionParameters
  ) => Promise<AsynchronousResult<Result>>,
): UseAsynchronousResultResponse<Result, FunctionParameters> => {
  const { asynchronousCallback } = useAsynchronous(asynchronousFunction);
  const [state, setState] =
    useState<AsynchronousResultState<Result>>(initialState);
  const latestRequestNumber = useRef(0);

  const load = useCallback(
    async (...parameters: FunctionParameters) => {
      latestRequestNumber.current += 1;
      const requestNumber = latestRequestNumber.current;
      const isLatestRequest = () =>
        requestNumber === latestRequestNumber.current;
      setState((previousState) => ({
        ...previousState,
        error: null,
        isLoading: previousState.result === null,
        isRequesting: true,
      }));
      try {
        const result = await asynchronousCallback(...parameters);
        if (isLatestRequest()) {
          setState({
            error: null,
            isLoading: false,
            isRequesting: false,
            result,
          });
        }
        return result;
      } catch (error) {
        if (isLatestRequest()) {
          setState((previousState) => ({
            error: error as AsynchronousOperationError,
            isLoading: false,
            isRequesting: false,
            result: previousState.result,
          }));
        }
        throw error;
      }
    },
    [asynchronousCallback],
  );

  return { ...state, load };
};

export default useAsynchronousResult;
