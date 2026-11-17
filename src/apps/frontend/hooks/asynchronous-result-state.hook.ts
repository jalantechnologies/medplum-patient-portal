import { useMemo } from "react";

import type { AsynchronousResult } from "../types";
import useAsynchronousResult from "./asynchronous-result.hook";

const useAsynchronousResultState = <
  Result,
  FunctionParameters extends unknown[],
>(
  asynchronousFunction: (
    ...parameters: FunctionParameters
  ) => Promise<AsynchronousResult<Result>>,
) => {
  const { error, hasAnswer, isRequesting, load, requestNumber, result } =
    useAsynchronousResult(asynchronousFunction);
  const state = useMemo(
    () => ({ error, hasAnswer, isRequesting, requestNumber, result }),
    [error, hasAnswer, isRequesting, requestNumber, result],
  );
  return { load, state };
};

export default useAsynchronousResultState;
