import { onTestFinished, vi } from "vitest";

export const silenceExpectedRenderError = (expectedFailure: string) => {
  const writeError = console.error.bind(console);
  const isExpectedError = (value: unknown): boolean =>
    value instanceof Error &&
    (value.message.includes(expectedFailure) || isExpectedError(value.cause));
  const isReactBoundaryReport = (value: unknown) =>
    String(value).startsWith("The above error occurred in the");
  const keepFromReport = (event: ErrorEvent) => {
    if (isExpectedError(event.error)) {
      event.preventDefault();
    }
  };
  vi.spyOn(console, "error").mockImplementation((...messages: unknown[]) => {
    if (
      !messages.some(isExpectedError) &&
      !isReactBoundaryReport(messages[0])
    ) {
      writeError(...messages);
    }
  });
  window.addEventListener("error", keepFromReport);
  onTestFinished(() => window.removeEventListener("error", keepFromReport));
};
