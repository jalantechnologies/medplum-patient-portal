import { normalizeErrorString, OperationOutcomeError } from "@medplum/core";

import type { Nullable } from "./common";

export interface AsynchronousResult<Data> {
  data?: Nullable<Data>;
}

export class AsynchronousOperationError extends Error {
  static fromUnknown(
    thrown: unknown,
    fallbackMessage: string,
  ): AsynchronousOperationError {
    if (thrown instanceof AsynchronousOperationError) {
      return thrown;
    }
    const message =
      thrown instanceof OperationOutcomeError
        ? normalizeErrorString(thrown)
        : fallbackMessage;
    return new AsynchronousOperationError(message, { cause: thrown });
  }
}

export interface AsynchronousResultState<Result> {
  error: Nullable<AsynchronousOperationError>;
  hasAnswer: boolean;
  isRequesting: boolean;
  requestNumber: number;
  result: Nullable<Result>;
}
