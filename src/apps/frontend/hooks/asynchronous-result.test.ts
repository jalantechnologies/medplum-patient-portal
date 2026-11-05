import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AsynchronousOperationError, ServiceResponse } from "../types";
import useAsynchronousResult from "./asynchronous-result.hook";

const createPendingAnswer = () => {
  let resolve!: (answer: ServiceResponse<string>) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<ServiceResponse<string>>(
    (resolvePromise, rejectPromise) => {
      resolve = resolvePromise;
      reject = rejectPromise;
    },
  );
  return { promise, reject, resolve };
};

const renderAnsweringHook = () => {
  const firstAnswer = createPendingAnswer();
  const secondAnswer = createPendingAnswer();
  const answerQuestion = vi
    .fn<(question: string) => Promise<ServiceResponse<string>>>()
    .mockReturnValueOnce(firstAnswer.promise)
    .mockReturnValueOnce(secondAnswer.promise);
  const { result } = renderHook(() => useAsynchronousResult(answerQuestion));
  return { firstAnswer, result, secondAnswer };
};

describe("useAsynchronousResult", () => {
  it("keeps the answer to the latest request when an earlier request fails after it", async () => {
    const { firstAnswer, result, secondAnswer } = renderAnsweringHook();

    let firstLoad: Promise<unknown> = Promise.resolve();
    let secondLoad: Promise<unknown> = Promise.resolve();
    act(() => {
      firstLoad = result.current.load("first");
      secondLoad = result.current.load("second");
    });
    await act(async () => {
      secondAnswer.resolve(new ServiceResponse("second answer"));
      await secondLoad;
    });
    await act(async () => {
      firstAnswer.reject(new AsynchronousOperationError("first failed"));
      await expect(firstLoad).rejects.toThrow("first failed");
    });

    expect(result.current).toMatchObject({
      error: null,
      isLoading: false,
      isRequesting: false,
      result: "second answer",
    });
  });

  it("stays requesting until the latest request answers, whatever an earlier one answers first", async () => {
    const { firstAnswer, result, secondAnswer } = renderAnsweringHook();

    let firstLoad: Promise<unknown> = Promise.resolve();
    let secondLoad: Promise<unknown> = Promise.resolve();
    act(() => {
      firstLoad = result.current.load("first");
      secondLoad = result.current.load("second");
    });
    await act(async () => {
      firstAnswer.resolve(new ServiceResponse("first answer"));
      await firstLoad;
    });

    expect(result.current).toMatchObject({
      isLoading: true,
      isRequesting: true,
      result: null,
    });

    await act(async () => {
      secondAnswer.resolve(new ServiceResponse("second answer"));
      await secondLoad;
    });

    expect(result.current).toMatchObject({
      isLoading: false,
      isRequesting: false,
      result: "second answer",
    });
  });
});
