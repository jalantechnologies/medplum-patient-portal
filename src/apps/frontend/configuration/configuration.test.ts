import { describe, expect, it } from "vitest";

import { readConfiguration } from "./configuration";

describe("readConfiguration", () => {
  it("reads the Medplum server address and project identifier", () => {
    expect(
      readConfiguration({
        VITE_MEDPLUM_SERVER_ADDRESS: "http://localhost:8103/",
        VITE_MEDPLUM_PROJECT_IDENTIFIER: "synthetic-project",
      }),
    ).toEqual({
      medplumServerAddress: "http://localhost:8103/",
      medplumProjectIdentifier: "synthetic-project",
    });
  });

  it("names every missing or empty value at once", () => {
    const readIncompleteConfiguration = () =>
      readConfiguration({ VITE_MEDPLUM_PROJECT_IDENTIFIER: "" });

    expect(readIncompleteConfiguration).toThrow(/VITE_MEDPLUM_SERVER_ADDRESS/);
    expect(readIncompleteConfiguration).toThrow(
      /VITE_MEDPLUM_PROJECT_IDENTIFIER/,
    );
  });
});
