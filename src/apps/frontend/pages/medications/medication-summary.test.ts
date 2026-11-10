import { createReference } from "@medplum/core";
import type { Medication, MedicationRequest } from "@medplum/fhirtypes";
import { HomerSimpson } from "@medplum/mock";
import { describe, expect, it } from "vitest";

import {
  CONTAINED_REFERENCE_PREFIX,
  MEDICATION_REQUEST_INTENT,
  MEDICATION_REQUEST_STATUS,
  RESOURCE_TYPE,
  TIMING_PERIOD_UNIT,
} from "../../constants/fhir";
import { summarizeMedicationRequest } from "./medication-summary";

const summarize = (overrides: Partial<MedicationRequest>) =>
  summarizeMedicationRequest({
    resourceType: RESOURCE_TYPE.MEDICATION_REQUEST,
    id: "triamcinolone",
    status: MEDICATION_REQUEST_STATUS.ACTIVE,
    intent: MEDICATION_REQUEST_INTENT.ORDER,
    subject: createReference(HomerSimpson),
    ...overrides,
  });

const amlodipine: Medication = {
  resourceType: RESOURCE_TYPE.MEDICATION,
  id: "amlodipine",
  code: { text: "Amlodipine 5 mg tablet" },
};

describe("summarizeMedicationRequest", () => {
  it.each([
    [
      "its coded name",
      {
        medicationCodeableConcept: {
          coding: [{ display: "Hydrocortisone 1% cream" }],
        },
      },
      "Hydrocortisone 1% cream",
    ],
    [
      "the first coding that has a name, when its code has no text",
      {
        medicationCodeableConcept: {
          coding: [
            { code: "0093-7155-98" },
            { code: "197361", display: "Amlodipine 5 MG Oral Tablet" },
            { code: "308135", display: "Amlodipine 10 MG Oral Tablet" },
          ],
        },
      },
      "Amlodipine 5 MG Oral Tablet",
    ],
    [
      "the name on its reference",
      {
        medicationReference: {
          ...createReference<Medication>({
            resourceType: RESOURCE_TYPE.MEDICATION,
            id: "adapalene",
          }),
          display: "Adapalene 0.1% gel",
        },
      },
      "Adapalene 0.1% gel",
    ],
    [
      "the medicine it contains, when it refers to that medicine",
      {
        contained: [amlodipine],
        medicationReference: {
          reference: `${CONTAINED_REFERENCE_PREFIX}${amlodipine.id}`,
        },
      },
      "Amlodipine 5 mg tablet",
    ],
    [
      "a plain word when it contains a medicine it does not refer to",
      {
        contained: [amlodipine],
        medicationReference: {
          reference: `${CONTAINED_REFERENCE_PREFIX}other`,
        },
      },
      "Medication",
    ],
    [
      "a plain word when its codings have no name",
      { medicationCodeableConcept: { coding: [{ code: "197361" }] } },
      "Medication",
    ],
    ["a plain word when it has no name", {}, "Medication"],
  ])("names the medicine by %s", (_, overrides, title) => {
    expect(summarize(overrides).title).toBe(title);
  });

  it("prefers the instructions written for the patient, then the clinic's text, then the timing, with one line for each dosage", () => {
    expect(
      summarize({
        dosageInstruction: [
          {
            text: "Apply BID",
            patientInstruction: "Apply a thin layer twice a day.",
          },
          { text: "Then once a day for 7 days." },
          {
            timing: {
              repeat: {
                frequency: 2,
                period: 1,
                periodUnit: TIMING_PERIOD_UNIT.DAY,
              },
            },
          },
          { doseAndRate: [{ doseQuantity: { value: 1 } }] },
        ],
      }).instructions,
    ).toEqual([
      "Apply a thin layer twice a day.",
      "Then once a day for 7 days.",
      "2 times per day",
    ]);
  });

  it("lists the dosages in the order their sequence gives, and those with no sequence last", () => {
    expect(
      summarize({
        dosageInstruction: [
          { text: "Use as needed after that." },
          { sequence: 2, text: "Then once daily for 7 days." },
          { sequence: 1, text: "Twice daily for 7 days." },
        ],
      }).instructions,
    ).toEqual([
      "Twice daily for 7 days.",
      "Then once daily for 7 days.",
      "Use as needed after that.",
    ]);
  });

  it.each([
    [MEDICATION_REQUEST_STATUS.ACTIVE, "Active"],
    [MEDICATION_REQUEST_STATUS.ON_HOLD, "On hold"],
  ])("words the status %s as %s", (status, words) => {
    expect(summarize({ status }).status).toBe(words);
  });

  it.each([
    [true, true],
    [false, false],
    [undefined, false],
  ])(
    "marks an order not to take the medicine when doNotPerform is %s: %s",
    (doNotPerform, isDoNotPerform) => {
      expect(summarize({ doNotPerform }).isDoNotPerform).toBe(isDoNotPerform);
    },
  );

  it("leaves the prescriber and the date empty when the prescription has neither", () => {
    expect(summarize({})).toEqual(
      expect.objectContaining({ date: "", prescriber: "" }),
    );
  });
});
