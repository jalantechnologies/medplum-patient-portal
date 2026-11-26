import { MockClient } from "@medplum/mock";
import { render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";

import App from "./app.component";
import { MedplumService } from "./services";

describe("App, drawn by React's StrictMode as main.tsx draws it", () => {
  it("creates one Medplum client for the page load, though React draws the app twice in development", async () => {
    const createMedplumClient = vi
      .spyOn(MedplumService, "createMedplumClient")
      .mockReturnValue(new MockClient({ profile: null }));

    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );

    expect(await screen.findByTestId("email")).toBeInTheDocument();
    expect(createMedplumClient).toHaveBeenCalledOnce();
  });
});
