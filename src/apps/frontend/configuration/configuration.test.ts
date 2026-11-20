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
      isSignUpEnabled: false,
    });
  });

  it("turns sign-up on only when the setting says so", () => {
    const readSignUpSetting = (setting: string) =>
      readConfiguration({
        VITE_MEDPLUM_SERVER_ADDRESS: "http://localhost:8103/",
        VITE_MEDPLUM_PROJECT_IDENTIFIER: "synthetic-project",
        VITE_SIGN_UP_ENABLED: setting,
      }).isSignUpEnabled;

    expect(readSignUpSetting("true")).toBe(true);
    expect(readSignUpSetting("false")).toBe(false);
  });

  it("leaves sign-up off when its setting is blank", () => {
    expect(
      readConfiguration({
        VITE_MEDPLUM_SERVER_ADDRESS: "http://localhost:8103/",
        VITE_MEDPLUM_PROJECT_IDENTIFIER: "synthetic-project",
        VITE_SIGN_UP_ENABLED: "",
      }).isSignUpEnabled,
    ).toBe(false);
  });

  it("names a sign-up setting that is neither true nor false", () => {
    expect(() =>
      readConfiguration({
        VITE_MEDPLUM_SERVER_ADDRESS: "http://localhost:8103/",
        VITE_MEDPLUM_PROJECT_IDENTIFIER: "synthetic-project",
        VITE_SIGN_UP_ENABLED: "sometimes",
      }),
    ).toThrow(/VITE_SIGN_UP_ENABLED/);
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
