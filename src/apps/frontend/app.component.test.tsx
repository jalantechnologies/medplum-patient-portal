import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import App from "./app.component";
import { silenceExpectedRenderError } from "./test-render-error";

const BLOCKED_STORAGE_FAILURE = "The operation is insecure.";

const browserStorage = Object.getOwnPropertyDescriptor(window, "localStorage");

const blockBrowserStorage = () =>
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    get: () => {
      throw Object.assign(new Error(BLOCKED_STORAGE_FAILURE), {
        name: "SecurityError",
      });
    },
  });

describe("App", () => {
  afterEach(() => {
    if (browserStorage) {
      Object.defineProperty(window, "localStorage", browserStorage);
    }
  });

  it("shows the error on a screen of its own when the browser blocks the storage the portal keeps its session in", async () => {
    silenceExpectedRenderError(BLOCKED_STORAGE_FAILURE);
    blockBrowserStorage();

    render(<App />);

    const applicationError = await screen.findByTestId("application-error");
    expect(screen.getByRole("main")).toBe(applicationError);
    expect(
      within(applicationError).getByTestId("page-error-retry"),
    ).toHaveFocus();
    expect(
      within(applicationError).getByRole("heading", { level: 1 }),
    ).toHaveTextContent("Something went wrong");
  });
});
