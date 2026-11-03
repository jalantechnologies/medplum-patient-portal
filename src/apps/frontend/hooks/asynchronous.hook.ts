import { useCallback, useState } from "react";

import constant from "../constants";
import {
  AsynchronousOperationError,
  type AsynchronousResult,
  type Nullable,
} from "../types";

interface UseAsynchronousResponse<
  Result,
  FunctionParameters extends unknown[],
> {
  asynchronousCallback: (
    ...parameters: FunctionParameters
  ) => Promise<Nullable<Result>>;
  isLoading: boolean;
}

const useAsynchronous = <Result, FunctionParameters extends unknown[]>(
  asynchronousFunction: (
    ...parameters: FunctionParameters
  ) => Promise<AsynchronousResult<Result>>,
): UseAsynchronousResponse<Result, FunctionParameters> => {
  const [isLoading, setIsLoading] = useState(false);

  const asynchronousCallback = useCallback(
    async (...parameters: FunctionParameters) => {
      setIsLoading(true);
      try {
        const response = await asynchronousFunction(...parameters);
        return response.data ?? null;
      } catch (thrown) {
        throw AsynchronousOperationError.fromUnknown(
          thrown,
          constant.DEFAULT_ERROR_MESSAGE,
        );
      } finally {
        setIsLoading(false);
      }
    },
    [asynchronousFunction],
  );

  return {
    asynchronousCallback,
    isLoading,
  };
};

export default useAsynchronous;
