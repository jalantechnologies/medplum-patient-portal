import { useState } from "react";

import type { AsynchronousResultState } from "../types";
import { isLoadingResult } from "./asynchronous-result.hook";

// A provider can outlive the pages that read it, and each page asks again when it arrives, so the failure of a request made before a page arrived belongs to an earlier page.
const useReader = <Result>({
  error,
  hasAnswer,
  requestNumber,
  result,
}: AsynchronousResultState<Result>) => {
  const [requestNumberOnArrival] = useState(requestNumber);
  const shownError = requestNumber > requestNumberOnArrival ? error : null;
  return {
    error: shownError,
    isLoading: isLoadingResult({ error: shownError, hasAnswer }),
    result,
  };
};

export default useReader;
