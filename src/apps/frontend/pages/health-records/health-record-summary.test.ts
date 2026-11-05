import { describe, expect, it } from "vitest";

import { OBSERVATION_STATUS, RESOURCE_TYPE } from "../../constants/fhir";
import { summarizeVitalSign } from "./health-record-summary";

describe("summarizeVitalSign", () => {
  it.each([
    [OBSERVATION_STATUS.FINAL, "Final"],
    [OBSERVATION_STATUS.ENTERED_IN_ERROR, "Entered in error"],
  ])("words the status %s as %s", (status, words) => {
    expect(
      summarizeVitalSign({
        resourceType: RESOURCE_TYPE.OBSERVATION,
        id: "blood-pressure",
        status,
        code: { text: "Blood pressure" },
      }).status,
    ).toBe(words);
  });
});
