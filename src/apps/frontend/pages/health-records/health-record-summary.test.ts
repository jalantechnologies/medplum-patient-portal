import { createReference } from "@medplum/core";
import type { CodeableConcept } from "@medplum/fhirtypes";
import { HomerSimpson } from "@medplum/mock";
import { describe, expect, it } from "vitest";

import { OBSERVATION_STATUS, RESOURCE_TYPE } from "../../constants/fhir";
import {
  summarizeAllergyIntolerance,
  summarizeCondition,
  summarizeVitalSign,
} from "./health-record-summary";

const homer = createReference(HomerSimpson);

describe("naming a health record", () => {
  const multiplyCoded: CodeableConcept = {
    coding: [
      { code: "L20.9" },
      { code: "24079001", display: "Atopic dermatitis" },
      { code: "L20.89", display: "Other atopic dermatitis" },
    ],
  };

  it.each([
    [
      "a condition",
      (code: CodeableConcept) =>
        summarizeCondition({
          resourceType: RESOURCE_TYPE.CONDITION,
          id: "eczema",
          subject: homer,
          code,
        }),
      "Condition",
    ],
    [
      "an allergy",
      (code: CodeableConcept) =>
        summarizeAllergyIntolerance({
          resourceType: RESOURCE_TYPE.ALLERGY_INTOLERANCE,
          id: "peanut",
          patient: homer,
          code,
        }),
      "Allergy",
    ],
    [
      "a measurement",
      (code: CodeableConcept) =>
        summarizeVitalSign({
          resourceType: RESOURCE_TYPE.OBSERVATION,
          id: "weight",
          status: OBSERVATION_STATUS.FINAL,
          code,
        }),
      "Measurement",
    ],
  ])(
    "names %s by its text, else its first coding that has a name, else a plain word",
    (_, summarize, plainWord) => {
      expect(summarize({ ...multiplyCoded, text: "Eczema" }).title).toBe(
        "Eczema",
      );
      expect(summarize(multiplyCoded).title).toBe("Atopic dermatitis");
      expect(summarize({ coding: [{ code: "L20.9" }] }).title).toBe(plainWord);
    },
  );
});

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
