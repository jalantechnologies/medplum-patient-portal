import {
  createReference,
  getReferenceString,
  type WithId,
} from "@medplum/core";
import type { Dosage, Medication, MedicationRequest } from "@medplum/fhirtypes";
import { HomerSimpson } from "@medplum/mock";
import { describe, expect, it } from "vitest";

import {
  CONTAINED_REFERENCE_PREFIX,
  MEDICATION_REQUEST_INTENT,
  MEDICATION_REQUEST_STATUS,
  MEDICATION_STATUS,
  REFERENCE_HISTORY_SEGMENT,
  RESOURCE_TYPE,
  TIMING_PERIOD_UNIT,
} from "../../constants/fhir";
import type { MedicationsByReference } from "../../types";
import { summarizeMedicationRequest } from "./medication-summary";

const summarize = (
  overrides: Partial<MedicationRequest>,
  medications: MedicationsByReference = new Map(),
) =>
  summarizeMedicationRequest(
    {
      resourceType: RESOURCE_TYPE.MEDICATION_REQUEST,
      id: "triamcinolone",
      status: MEDICATION_REQUEST_STATUS.ACTIVE,
      intent: MEDICATION_REQUEST_INTENT.ORDER,
      subject: createReference(HomerSimpson),
      ...overrides,
    },
    { medications, nextPosition: null, resources: [] },
  );

const amlodipine: WithId<Medication> = {
  resourceType: RESOURCE_TYPE.MEDICATION,
  id: "amlodipine",
  code: { text: "Amlodipine 5 mg tablet" },
};

const compoundedPaste: Medication = {
  resourceType: RESOURCE_TYPE.MEDICATION,
  ingredient: [
    { itemCodeableConcept: { text: "Hydrocortisone" } },
    { itemReference: { display: "Zinc oxide" } },
    { itemCodeableConcept: { coding: [{ code: "387253001" }] } },
  ],
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

  const amlodipineReference = getReferenceString(amlodipine);
  const amlodipineVersionReference = `${amlodipineReference}/${REFERENCE_HISTORY_SEGMENT}/1`;
  const referenceToAmlodipine = {
    medicationReference: { reference: amlodipineReference },
  };
  const amlodipineAs = (medication: Medication): MedicationsByReference =>
    new Map([[amlodipineReference, medication]]);

  it.each<[string, Partial<MedicationRequest>, MedicationsByReference, string]>(
    [
      [
        "the code of the medicine it refers to",
        referenceToAmlodipine,
        amlodipineAs(amlodipine),
        "Amlodipine 5 mg tablet",
      ],
      [
        "the version of the medicine it refers to, not the medicine's current version",
        { medicationReference: { reference: amlodipineVersionReference } },
        new Map([
          [
            amlodipineReference,
            { ...amlodipine, code: { text: "Amlodipine 10 mg tablet" } },
          ],
          [amlodipineVersionReference, amlodipine],
        ]),
        "Amlodipine 5 mg tablet",
      ],
      [
        "the name on its reference, before the medicine it refers to",
        {
          medicationReference: {
            ...referenceToAmlodipine.medicationReference,
            display: "Amlodipine",
          },
        },
        amlodipineAs(amlodipine),
        "Amlodipine",
      ],
      [
        "the named ingredients of the medicine it refers to, when that medicine has no code",
        referenceToAmlodipine,
        amlodipineAs(compoundedPaste),
        "Hydrocortisone, Zinc oxide",
      ],
      [
        "the code of the medicine it refers to, before its ingredients",
        referenceToAmlodipine,
        amlodipineAs({ ...compoundedPaste, code: { text: "Diaper paste" } }),
        "Diaper paste",
      ],
      [
        "a plain word when Medplum did not send the medicine it refers to",
        referenceToAmlodipine,
        new Map(),
        "Medication",
      ],
      [
        "a plain word when the medicine it refers to was entered in error",
        referenceToAmlodipine,
        amlodipineAs({
          ...amlodipine,
          status: MEDICATION_STATUS.ENTERED_IN_ERROR,
        }),
        "Medication",
      ],
      [
        "a plain word when the medicine it refers to has no named code or ingredient",
        referenceToAmlodipine,
        amlodipineAs({
          resourceType: RESOURCE_TYPE.MEDICATION,
          code: { coding: [{ code: "197361" }] },
          ingredient: [{ itemCodeableConcept: { coding: [{ code: "1" }] } }],
        }),
        "Medication",
      ],
    ],
  )("names the medicine by %s", (_, overrides, medications, title) => {
    expect(summarize(overrides, medications).title).toBe(title);
  });

  it("prefers the instructions written for the patient, then the clinic's text, then its coded parts, with one line for each dosage", () => {
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
      "Dose: 1",
    ]);
  });

  it.each<[string, Dosage, string]>([
    [
      "by its dose and how often, as Synthea codes them",
      {
        sequence: 1,
        asNeededBoolean: false,
        timing: {
          repeat: {
            frequency: 1,
            period: 1,
            periodUnit: TIMING_PERIOD_UNIT.DAY,
          },
        },
        doseAndRate: [{ doseQuantity: { value: 1 } }],
      },
      "Dose: 1 · Daily",
    ],
    [
      "by its dose with its unit, how often and the reason to take it as needed",
      {
        timing: {
          repeat: {
            frequency: 2,
            period: 1,
            periodUnit: TIMING_PERIOD_UNIT.DAY,
          },
        },
        asNeededCodeableConcept: { text: "shortness of breath" },
        doseAndRate: [{ doseQuantity: { value: 2, unit: "puff" } }],
      },
      "Dose: 2 puff · 2 times per day · As needed for shortness of breath",
    ],
    [
      "as needed, when that is all it says",
      { asNeededBoolean: true },
      "As needed",
    ],
    [
      "as needed, when the reason's code has no name",
      { asNeededCodeableConcept: { coding: [{ code: "267036007" }] } },
      "As needed",
    ],
    [
      "by its range of doses",
      {
        doseAndRate: [
          {
            doseRange: {
              low: { value: 1, unit: "tablet" },
              high: { value: 2, unit: "tablet" },
            },
          },
        ],
      },
      "Dose: 1 - 2 tablet",
    ],
    [
      "by the first entry that gives a dose",
      {
        doseAndRate: [
          { rateQuantity: { value: 5, unit: "mL/h" } },
          { doseQuantity: { value: 10, unit: "mg" } },
          { doseQuantity: { value: 20, unit: "mg" } },
        ],
      },
      "Dose: 10 mg",
    ],
    [
      "by its timing's code, when the timing has only a code",
      { timing: { code: { text: "Twice a day" } } },
      "Twice a day",
    ],
    [
      "by the name of its timing's code, when the code has no text",
      {
        timing: { code: { coding: [{ code: "2XD", display: "Twice a day" }] } },
      },
      "Twice a day",
    ],
    [
      "by its timing code's text, when the timing also has a repeat",
      {
        timing: {
          code: { text: "Every morning before breakfast" },
          repeat: {
            frequency: 1,
            period: 1,
            periodUnit: TIMING_PERIOD_UNIT.DAY,
          },
        },
      },
      "Every morning before breakfast",
    ],
    [
      "by its timing's repeat, when the timing's code has no text",
      {
        timing: {
          code: { coding: [{ code: "BID", display: "BID" }] },
          repeat: {
            frequency: 2,
            period: 1,
            periodUnit: TIMING_PERIOD_UNIT.DAY,
          },
        },
      },
      "2 times per day",
    ],
    [
      "by the clinic's text alone, when it also has coded parts",
      {
        text: "Take 1 tablet by mouth daily.",
        timing: {
          repeat: {
            frequency: 1,
            period: 1,
            periodUnit: TIMING_PERIOD_UNIT.DAY,
          },
        },
        doseAndRate: [{ doseQuantity: { value: 1, unit: "tablet" } }],
      },
      "Take 1 tablet by mouth daily.",
    ],
  ])("words the dosage %s", (_, dosage, instruction) => {
    expect(summarize({ dosageInstruction: [dosage] }).instructions).toEqual([
      instruction,
    ]);
  });

  it("gives no line for a dosage that only says it is not taken as needed", () => {
    expect(
      summarize({ dosageInstruction: [{ asNeededBoolean: false }] })
        .instructions,
    ).toEqual([]);
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
