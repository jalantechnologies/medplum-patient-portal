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

  it("keeps the last answer, without loading, while it asks again and after that request fails", async () => {
    const { firstAnswer, result, secondAnswer } = renderAnsweringHook();

    await act(async () => {
      const firstLoad = result.current.load("first");
      firstAnswer.resolve(new ServiceResponse("first answer"));
      await firstLoad;
    });
    let secondLoad: Promise<unknown> = Promise.resolve();
    act(() => {
      secondLoad = result.current.load("second");
    });

    expect(result.current).toMatchObject({
      isLoading: false,
      isRequesting: true,
      result: "first answer",
    });

    await act(async () => {
      secondAnswer.reject(new AsynchronousOperationError("second failed"));
      await expect(secondLoad).rejects.toThrow("second failed");
    });

    expect(result.current).toMatchObject({
      error: new AsynchronousOperationError("second failed"),
      isLoading: false,
      isRequesting: false,
      result: "first answer",
    });
  });

  it("keeps an empty answer, without loading, while it asks again and after that request fails", async () => {
    const { firstAnswer, result, secondAnswer } = renderAnsweringHook();

    await act(async () => {
      const firstLoad = result.current.load("first");
      firstAnswer.resolve(new ServiceResponse<string>());
      await firstLoad;
    });

    expect(result.current).toMatchObject({
      error: null,
      isLoading: false,
      isRequesting: false,
      result: null,
    });

    let secondLoad: Promise<unknown> = Promise.resolve();
    act(() => {
      secondLoad = result.current.load("second");
    });

    expect(result.current).toMatchObject({
      isLoading: false,
      isRequesting: true,
      result: null,
    });

    await act(async () => {
      secondAnswer.reject(new AsynchronousOperationError("second failed"));
      await expect(secondLoad).rejects.toThrow("second failed");
    });

    expect(result.current).toMatchObject({
      error: new AsynchronousOperationError("second failed"),
      isLoading: false,
      isRequesting: false,
      result: null,
    });
  });

  it("keeps an answer that arrives after the last reader left", async () => {
    const { firstAnswer, result } = renderAnsweringHook();

    let firstLoad: Promise<unknown> = Promise.resolve();
    act(() => {
      const removeReader = result.current.addReader();
      firstLoad = result.current.load("first");
      removeReader();
    });
    await act(async () => {
      firstAnswer.resolve(new ServiceResponse("first answer"));
      await firstLoad;
    });

    expect(result.current).toMatchObject({
      error: null,
      isLoading: false,
      isRequesting: false,
      result: "first answer",
    });
  });

  it("stays requesting after the last reader left, then hides that request's failure and keeps the last answer", async () => {
    const { firstAnswer, result, secondAnswer } = renderAnsweringHook();

    await act(async () => {
      const firstLoad = result.current.load("first");
      firstAnswer.resolve(new ServiceResponse("first answer"));
      await firstLoad;
    });
    let secondLoad: Promise<unknown> = Promise.resolve();
    act(() => {
      const removeReader = result.current.addReader();
      secondLoad = result.current.load("second");
      removeReader();
    });

    expect(result.current).toMatchObject({
      isLoading: false,
      isRequesting: true,
      result: "first answer",
    });

    await act(async () => {
      secondAnswer.reject(new AsynchronousOperationError("second failed"));
      await expect(secondLoad).rejects.toThrow("second failed");
    });

    expect(result.current).toMatchObject({
      error: null,
      isLoading: false,
      isRequesting: false,
      result: "first answer",
    });
  });

  it("forgets the last failure and keeps the last answer when the last reader leaves", async () => {
    const { firstAnswer, result, secondAnswer } = renderAnsweringHook();

    await act(async () => {
      const firstLoad = result.current.load("first");
      firstAnswer.resolve(new ServiceResponse("first answer"));
      await firstLoad;
    });
    let removeReader = () => {};
    await act(async () => {
      removeReader = result.current.addReader();
      const secondLoad = result.current.load("second");
      secondAnswer.reject(new AsynchronousOperationError("second failed"));
      await expect(secondLoad).rejects.toThrow("second failed");
    });

    expect(result.current).toMatchObject({
      error: new AsynchronousOperationError("second failed"),
      result: "first answer",
    });

    act(() => {
      removeReader();
    });

    expect(result.current).toMatchObject({
      error: null,
      isLoading: false,
      isRequesting: false,
      result: "first answer",
    });
  });

  it("forgets a failure that came before any answer when the last reader leaves, and shows loading again", async () => {
    const { firstAnswer, result } = renderAnsweringHook();

    let removeReader = () => {};
    await act(async () => {
      removeReader = result.current.addReader();
      const firstLoad = result.current.load("first");
      firstAnswer.reject(new AsynchronousOperationError("first failed"));
      await expect(firstLoad).rejects.toThrow("first failed");
    });
    act(() => {
      removeReader();
    });

    expect(result.current).toMatchObject({
      error: null,
      isLoading: true,
      isRequesting: false,
      result: null,
    });
  });

  it("keeps the failure while another reader still reads it", async () => {
    const { firstAnswer, result } = renderAnsweringHook();

    let removeFirstReader = () => {};
    let removeSecondReader = () => {};
    await act(async () => {
      removeFirstReader = result.current.addReader();
      removeSecondReader = result.current.addReader();
      const firstLoad = result.current.load("first");
      firstAnswer.reject(new AsynchronousOperationError("first failed"));
      await expect(firstLoad).rejects.toThrow("first failed");
    });
    act(() => {
      removeFirstReader();
    });

    expect(result.current.error).toEqual(
      new AsynchronousOperationError("first failed"),
    );

    act(() => {
      removeSecondReader();
    });

    expect(result.current.error).toBeNull();
  });

  it("shows the failure of a request still on its way when a reader comes back", async () => {
    const { firstAnswer, result } = renderAnsweringHook();

    let firstLoad: Promise<unknown> = Promise.resolve();
    act(() => {
      const removeReader = result.current.addReader();
      firstLoad = result.current.load("first");
      removeReader();
      result.current.addReader();
    });
    await act(async () => {
      firstAnswer.reject(new AsynchronousOperationError("first failed"));
      await expect(firstLoad).rejects.toThrow("first failed");
    });

    expect(result.current).toMatchObject({
      error: new AsynchronousOperationError("first failed"),
      isLoading: false,
      isRequesting: false,
    });
  });

  it("hides the failure of a request made after the last reader left", async () => {
    const { firstAnswer, result } = renderAnsweringHook();

    act(() => {
      const removeReader = result.current.addReader();
      removeReader();
    });
    await act(async () => {
      const firstLoad = result.current.load("first");
      firstAnswer.reject(new AsynchronousOperationError("first failed"));
      await expect(firstLoad).rejects.toThrow("first failed");
    });

    expect(result.current).toMatchObject({
      error: null,
      isLoading: true,
      isRequesting: false,
    });
  });

  it("forgets the failure when the last reader leaves, even after a reader was removed twice", async () => {
    const { firstAnswer, result } = renderAnsweringHook();

    let removeSecondReader = () => {};
    await act(async () => {
      const removeFirstReader = result.current.addReader();
      removeFirstReader();
      removeFirstReader();
      removeSecondReader = result.current.addReader();
      const firstLoad = result.current.load("first");
      firstAnswer.reject(new AsynchronousOperationError("first failed"));
      await expect(firstLoad).rejects.toThrow("first failed");
    });

    expect(result.current.error).toEqual(
      new AsynchronousOperationError("first failed"),
    );

    act(() => {
      removeSecondReader();
    });

    expect(result.current.error).toBeNull();
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
