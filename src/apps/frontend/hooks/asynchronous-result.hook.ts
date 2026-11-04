import { useCallback, useState } from "react";

import type {
  AsynchronousOperationError,
  AsynchronousResult,
  Nullable,
} from "../types";
import useAsynchronous from "./asynchronous.hook";

interface AsynchronousResultState<Result> {
  error: Nullable<AsynchronousOperationError>;
  isLoading: boolean;
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

  const load = useCallback(
    async (...parameters: FunctionParameters) => {
      setState((previousState) => ({
        ...previousState,
        error: null,
        isLoading: previousState.isLoading || previousState.error !== null,
      }));
      try {
        const result = await asynchronousCallback(...parameters);
        setState({ error: null, isLoading: false, result });
        return result;
      } catch (error) {
        setState({
          error: error as AsynchronousOperationError,
          isLoading: false,
          result: null,
        });
        throw error;
      }
    },
    [asynchronousCallback],
  );

  return { ...state, load };
};

export default useAsynchronousResult;
