import { createReference } from "@medplum/core";
import type {
  Annotation,
  CodeableConcept,
  Immunization,
  Observation,
  Procedure,
} from "@medplum/fhirtypes";
import { HomerSimpson } from "@medplum/mock";
import { describe, expect, it } from "vitest";

import {
  ALLERGY_INTOLERANCE_CLINICAL_STATUS,
  ALLERGY_INTOLERANCE_VERIFICATION_STATUS,
  CODE_SYSTEM,
  CONDITION_CLINICAL_STATUS,
  CONDITION_VERIFICATION_STATUS,
  IMMUNIZATION_STATUS,
  OBSERVATION_STATUS,
  PROCEDURE_STATUS,
  QUANTITY_COMPARATOR,
  RESOURCE_TYPE,
} from "../../constants/fhir";
import { codeFrom, oakDermatology, RECEIVED_AT } from "../../test-medplum";
import { showDatesInChicago } from "../../test-time-zone";
import { RecordSourceNames } from "../../types";
import {
  summarizeAllergyIntolerance,
  summarizeCondition,
  summarizeImmunization,
  summarizeProcedure,
  summarizeVitalSign,
} from "./health-record-summary";

const homer = createReference(HomerSimpson);

const noSourceNames = new RecordSourceNames();

const clinicVerification = {
  system: "http://example.org/clinic-verification",
  code: "disproven-by-challenge",
};

const codedAlsoElsewhere = (system: string, code: string): CodeableConcept => ({
  coding: [clinicVerification, { system, code }],
});

const summarizeAllergyStatus = (
  clinicalStatus: CodeableConcept | undefined,
  verificationStatus: CodeableConcept | undefined,
) =>
  summarizeAllergyIntolerance(
    {
      resourceType: RESOURCE_TYPE.ALLERGY_INTOLERANCE,
      id: "amoxicillin",
      patient: homer,
      code: { text: "Amoxicillin" },
      clinicalStatus,
      verificationStatus,
    },
    noSourceNames,
  );

const summarizeAllergyNotes = (note: Annotation[] | undefined) =>
  summarizeAllergyIntolerance(
    {
      resourceType: RESOURCE_TYPE.ALLERGY_INTOLERANCE,
      id: "penicillin",
      patient: homer,
      code: { text: "Penicillin" },
      note,
    },
    noSourceNames,
  ).notes;

const summarizeConditionStatus = (
  clinicalStatus: CodeableConcept | undefined,
  verificationStatus: CodeableConcept | undefined,
) =>
  summarizeCondition(
    {
      resourceType: RESOURCE_TYPE.CONDITION,
      id: "asthma",
      subject: homer,
      code: { text: "Asthma" },
      clinicalStatus,
      verificationStatus,
    },
    noSourceNames,
  );

const summarizeSkinBiopsy = (overrides: Partial<Procedure>) =>
  summarizeProcedure(
    {
      resourceType: RESOURCE_TYPE.PROCEDURE,
      id: "skin-biopsy",
      status: PROCEDURE_STATUS.COMPLETED,
      subject: homer,
      code: { text: "Skin biopsy" },
      ...overrides,
    },
    noSourceNames,
  );

const summarizeInfluenzaVaccine = (overrides: Partial<Immunization>) =>
  summarizeImmunization(
    {
      resourceType: RESOURCE_TYPE.IMMUNIZATION,
      id: "influenza-vaccine",
      status: IMMUNIZATION_STATUS.COMPLETED,
      patient: homer,
      vaccineCode: { text: "Influenza vaccine" },
      occurrenceDateTime: "2025-10-06",
      ...overrides,
    },
    noSourceNames,
  );

const summarizeVitalSignValue = (overrides: Partial<Observation>) =>
  summarizeVitalSign(
    {
      resourceType: RESOURCE_TYPE.OBSERVATION,
      id: "vital-sign",
      status: OBSERVATION_STATUS.FINAL,
      code: { text: "Vital sign" },
      ...overrides,
    },
    noSourceNames,
  ).value;

const allergyClinical = (code: string) =>
  codeFrom(CODE_SYSTEM.ALLERGY_INTOLERANCE_CLINICAL, code);

const allergyVerification = (code: string) =>
  codeFrom(CODE_SYSTEM.ALLERGY_INTOLERANCE_VERIFICATION, code);

const conditionClinical = (code: string) =>
  codeFrom(CODE_SYSTEM.CONDITION_CLINICAL, code);

const conditionVerification = (code: string) =>
  codeFrom(CODE_SYSTEM.CONDITION_VERIFICATION, code);

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
        summarizeCondition(
          {
            resourceType: RESOURCE_TYPE.CONDITION,
            id: "eczema",
            subject: homer,
            code,
          },
          noSourceNames,
        ),
      "Condition",
    ],
    [
      "an allergy",
      (code: CodeableConcept) =>
        summarizeAllergyIntolerance(
          {
            resourceType: RESOURCE_TYPE.ALLERGY_INTOLERANCE,
            id: "peanut",
            patient: homer,
            code,
          },
          noSourceNames,
        ),
      "Allergy",
    ],
    [
      "a measurement",
      (code: CodeableConcept) =>
        summarizeVitalSign(
          {
            resourceType: RESOURCE_TYPE.OBSERVATION,
            id: "weight",
            status: OBSERVATION_STATUS.FINAL,
            code,
          },
          noSourceNames,
        ),
      "Measurement",
    ],
    [
      "a procedure",
      (code: CodeableConcept) =>
        summarizeProcedure(
          {
            resourceType: RESOURCE_TYPE.PROCEDURE,
            id: "biopsy",
            status: PROCEDURE_STATUS.COMPLETED,
            subject: homer,
            code,
          },
          noSourceNames,
        ),
      "Procedure",
    ],
    [
      "an immunization",
      (vaccineCode: CodeableConcept) =>
        summarizeImmunization(
          {
            resourceType: RESOURCE_TYPE.IMMUNIZATION,
            id: "influenza-vaccine",
            status: IMMUNIZATION_STATUS.COMPLETED,
            patient: homer,
            vaccineCode,
            occurrenceDateTime: "2025-10-06",
          },
          noSourceNames,
        ),
      "Immunization",
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
      summarizeVitalSign(
        {
          resourceType: RESOURCE_TYPE.OBSERVATION,
          id: "blood-pressure",
          status,
          code: { text: "Blood pressure" },
        },
        noSourceNames,
      ).status,
    ).toBe(words);
  });

  it.each([
    [
      "a quantity with its unit",
      { valueQuantity: { value: 72, unit: "/min" } },
      "72 /min",
    ],
    [
      "a quantity of zero",
      { valueQuantity: { value: 0, unit: "/min" } },
      "0 /min",
    ],
    [
      "a quantity with a comparator",
      {
        valueQuantity: {
          value: 5,
          comparator: QUANTITY_COMPARATOR.LESS_THAN,
          unit: "mg/dL",
        },
      },
      "< 5 mg/dL",
    ],
    ["a percentage", { valueQuantity: { value: 97, unit: "%" } }, "97%"],
    ["a coded value", { valueCodeableConcept: { text: "Regular" } }, "Regular"],
    ["text", { valueString: "Taken after exercise" }, "Taken after exercise"],
    ["a whole number, such as a pain score", { valueInteger: 4 }, "4"],
    ["a whole number of zero", { valueInteger: 0 }, "0"],
    ["yes", { valueBoolean: true }, "Yes"],
    ["no", { valueBoolean: false }, "No"],
    [
      "a ratio",
      { valueRatio: { numerator: { value: 1 }, denominator: { value: 64 } } },
      "1:64",
    ],
    [
      "a ratio with a number on one side only",
      { valueRatio: { numerator: { value: 5, unit: "mg" } } },
      "5 mg:",
    ],
    [
      "a ratio with its units",
      {
        valueRatio: {
          numerator: { value: 5, unit: "mg" },
          denominator: { value: 1, unit: "mL" },
        },
      },
      "5 mg:1 mL",
    ],
    [
      "a range",
      {
        valueRange: {
          low: { value: 2, unit: "mg/dL" },
          high: { value: 4, unit: "mg/dL" },
        },
      },
      "2 - 4 mg/dL",
    ],
    [
      "a range with only a low end",
      { valueRange: { low: { value: 2, unit: "mg/dL" } } },
      ">= 2 mg/dL",
    ],
    [
      "a range with only a high end",
      { valueRange: { high: { value: 4, unit: "mg/dL" } } },
      "<= 4 mg/dL",
    ],
    [
      "a period of calendar days, on the days written",
      { valuePeriod: { start: "2026-10-18", end: "2026-10-20" } },
      "October 18, 2026 - October 20, 2026",
    ],
    [
      "a period of instants, on the patient's own calendar days",
      {
        valuePeriod: {
          start: "2026-10-19T02:00:00Z",
          end: "2026-10-20T02:00:00Z",
        },
      },
      "October 18, 2026 - October 19, 2026",
    ],
    [
      "a period with only a start",
      { valuePeriod: { start: "2026-10-18" } },
      "From October 18, 2026",
    ],
    [
      "a period with only an end",
      { valuePeriod: { end: "2026-10-20" } },
      "Until October 20, 2026",
    ],
    ["a date", { valueDateTime: "2026-10-18" }, "October 18, 2026"],
    [
      "a date known only to its month",
      { valueDateTime: "2026-10" },
      "October 2026",
    ],
    ["a date known only to its year", { valueDateTime: "2026" }, "2026"],
    [
      "an instant, on the patient's own calendar day",
      { valueDateTime: "2026-10-19T02:00:00Z" },
      "October 18, 2026",
    ],
    [
      "an instant written in another time zone, on the patient's own calendar day",
      { valueDateTime: "2026-10-19T03:00:00+10:00" },
      "October 18, 2026",
    ],
    ["a time of day, as written", { valueTime: "07:30:00" }, "7:30 AM"],
    [
      "a device recording, as not shown",
      {
        valueSampledData: {
          origin: { value: 0, unit: "mV" },
          period: 10,
          dimensions: 1,
          data: "2 4 3",
        },
      },
      "Device recording, not shown here",
    ],
  ])(
    "words a measurement recorded as %s, without repeating the name its title gives",
    (_, overrides, value) => {
      showDatesInChicago();

      expect(summarizeVitalSignValue(overrides)).toBe(value);
    },
  );

  it.each([
    ["no value at all", {}],
    ["a ratio with no number on either side", { valueRatio: {} }],
    [
      "a ratio with a note standing in for both numbers",
      {
        valueRatio: {
          extension: [
            {
              url: "http://example.org/titer-note",
              valueString: "Below detection",
            },
          ],
        },
      },
    ],
    [
      "a ratio whose sides have no number",
      { valueRatio: { numerator: {}, denominator: {} } },
    ],
  ])("words nothing for a measurement recorded with %s", (_, overrides) => {
    expect(summarizeVitalSignValue(overrides)).toBe("");
  });

  it("words a measurement's own value without a name, and a part with no name without one", () => {
    expect(
      summarizeVitalSignValue({
        code: { coding: [{ code: "72514-3" }] },
        valueInteger: 4,
        component: [
          { code: { coding: [{ code: "8480-6" }] }, valueInteger: 3 },
          { code: { text: "Readings taken" }, valueInteger: 2 },
        ],
      }),
    ).toBe("4 / 3 / Readings taken: 2");
  });

  it("words each part of a measurement, whatever its kind, in the clinic's order", () => {
    showDatesInChicago();

    expect(
      summarizeVitalSignValue({
        component: [
          {
            code: { text: "Systolic" },
            valueQuantity: { value: 118, unit: "mmHg" },
          },
          {
            code: { text: "Diastolic" },
            valueQuantity: { value: 76, unit: "mmHg" },
          },
          { code: { text: "Readings taken" }, valueInteger: 3 },
          { code: { text: "Irregular heartbeat" }, valueBoolean: false },
          {
            code: { text: "Cuff size" },
            valueCodeableConcept: { text: "Adult" },
          },
          { code: { text: "Taken on" }, valueDateTime: "2026-10-18" },
        ],
      }),
    ).toBe(
      "Systolic: 118 mmHg / Diastolic: 76 mmHg / Readings taken: 3 / Irregular heartbeat: No / Cuff size: Adult / Taken on: October 18, 2026",
    );
  });

  it("words parts recorded as a ratio, a range, a period, a moment, a time of day or a device recording", () => {
    showDatesInChicago();

    expect(
      summarizeVitalSignValue({
        component: [
          {
            code: { text: "Dilution" },
            valueRatio: {
              numerator: { value: 1 },
              denominator: { value: 64 },
            },
          },
          {
            code: { text: "Target" },
            valueRange: {
              low: { value: 2, unit: "mg/dL" },
              high: { value: 4, unit: "mg/dL" },
            },
          },
          {
            code: { text: "Series" },
            valuePeriod: { start: "2026-10-18", end: "2026-10-20" },
          },
          {
            code: { text: "Taken at" },
            valueDateTime: "2026-10-19T02:00:00Z",
          },
          { code: { text: "First reading" }, valueTime: "07:30:00" },
          {
            code: { text: "Trace" },
            valueSampledData: {
              origin: { value: 0, unit: "mV" },
              period: 10,
              dimensions: 1,
              data: "2 4 3",
            },
          },
        ],
      }),
    ).toBe(
      "Dilution: 1:64 / Target: 2 - 4 mg/dL / Series: October 18, 2026 - October 20, 2026 / Taken at: October 18, 2026 / First reading: 7:30 AM / Trace: Device recording, not shown here",
    );
  });

  it("words a part recorded as no when it is the only part", () => {
    expect(
      summarizeVitalSignValue({
        component: [
          { code: { text: "Irregular heartbeat" }, valueBoolean: false },
        ],
      }),
    ).toBe("Irregular heartbeat: No");
  });

  it("words two parts with the same value each, since each is a measurement of its own", () => {
    expect(
      summarizeVitalSignValue({
        component: [
          {
            code: { text: "First reading" },
            valueQuantity: { value: 118, unit: "mmHg" },
          },
          {
            code: { text: "Second reading" },
            valueQuantity: { value: 118, unit: "mmHg" },
          },
        ],
      }),
    ).toBe("First reading: 118 mmHg / Second reading: 118 mmHg");
  });

  it("words a part recorded as zero", () => {
    expect(
      summarizeVitalSignValue({
        component: [
          {
            code: { text: "Systolic" },
            valueQuantity: { value: 118, unit: "mmHg" },
          },
          { code: { text: "Missed beats" }, valueInteger: 0 },
        ],
      }),
    ).toBe("Systolic: 118 mmHg / Missed beats: 0");
  });

  it("leaves out a part with no value, with no separator left behind", () => {
    expect(
      summarizeVitalSignValue({
        component: [
          {
            code: { text: "Systolic" },
            valueQuantity: { value: 118, unit: "mmHg" },
          },
          {
            code: { text: "Diastolic" },
            dataAbsentReason: { text: "Cuff slipped" },
          },
          { code: { text: "Pulse" } },
        ],
      }),
    ).toBe("Systolic: 118 mmHg");
  });

  it("words the measurement's own value before its parts, and each only once", () => {
    expect(
      summarizeVitalSignValue({
        valueInteger: 7,
        component: [
          {
            code: { text: "Colony count" },
            valueQuantity: { value: 100000, unit: "CFU/mL" },
          },
        ],
      }),
    ).toBe("7 / Colony count: 100000 CFU/mL");
  });

  it("words nothing when neither the measurement nor its parts have a value", () => {
    expect(
      summarizeVitalSignValue({
        component: [{ code: { text: "Systolic" } }],
      }),
    ).toBe("");
  });
});

describe("summarizeProcedure", () => {
  const statusWords = {
    [PROCEDURE_STATUS.COMPLETED]: "Completed",
    [PROCEDURE_STATUS.ENTERED_IN_ERROR]: "Entered in error",
    [PROCEDURE_STATUS.IN_PROGRESS]: "In progress",
    [PROCEDURE_STATUS.NOT_DONE]: "Not done",
    [PROCEDURE_STATUS.ON_HOLD]: "On hold",
    [PROCEDURE_STATUS.PREPARATION]: "Preparation",
    [PROCEDURE_STATUS.STOPPED]: "Stopped",
    [PROCEDURE_STATUS.UNKNOWN]: "Unknown",
  } satisfies Record<Procedure["status"], string>;

  it.each(Object.entries(statusWords))(
    "words the status %s as %s, so a procedure not done never reads as done",
    (status, words) => {
      expect(
        summarizeSkinBiopsy({ status: status as Procedure["status"] }).status,
      ).toBe(words);
    },
  );

  it("names every clinician who performed a procedure, in the clinic's order, leaving out one recorded with no name", () => {
    expect(
      summarizeSkinBiopsy({
        performer: [
          { actor: { display: "Dr. Mira Synthetic" } },
          { actor: { reference: `${RESOURCE_TYPE.PRACTITIONER}/unnamed` } },
          { actor: { display: "Nurse Ana Synthetic" } },
        ],
      }).author,
    ).toBe("Dr. Mira Synthetic, Nurse Ana Synthetic");
  });

  it("names a clinician listed more than once, in several roles or through their role, only once", () => {
    expect(
      summarizeSkinBiopsy({
        performer: [
          {
            function: { text: "Surgeon" },
            actor: {
              reference: `${RESOURCE_TYPE.PRACTITIONER}/mira-synthetic`,
              display: "Dr. Mira Synthetic",
            },
          },
          { actor: { display: "Nurse Ana Synthetic" } },
          {
            function: { text: "Attending" },
            actor: {
              reference: `${RESOURCE_TYPE.PRACTITIONER}/mira-synthetic`,
              display: "Dr. Mira Synthetic",
            },
          },
          {
            actor: {
              reference: `${RESOURCE_TYPE.PRACTITIONER_ROLE}/mira-synthetic-dermatologist`,
              display: "Dr. Mira Synthetic",
            },
          },
        ],
      }).author,
    ).toBe("Dr. Mira Synthetic, Nurse Ana Synthetic");
  });

  it("names the clinician who performed a procedure, not the clinic they performed it for", () => {
    expect(
      summarizeSkinBiopsy({
        performer: [
          {
            actor: { display: "Dr. Mira Synthetic" },
            onBehalfOf: { display: oakDermatology.name },
          },
        ],
      }).author,
    ).toBe("Dr. Mira Synthetic");
  });

  it("names no one when the clinic recorded no performer", () => {
    expect(summarizeSkinBiopsy({ performer: undefined }).author).toBe("");
  });

  it.each([
    ["a day", { performedDateTime: "2024-03-12" }, "March 12, 2024"],
    ["a month", { performedDateTime: "2024-03" }, "March 2024"],
    [
      "a time, on the patient's own calendar day",
      { performedDateTime: "2024-03-13T03:30:00Z" },
      "March 12, 2024",
    ],
    [
      "a period, by its start",
      { performedPeriod: { start: "2024-03-12", end: "2024-03-14" } },
      "March 12, 2024",
    ],
    ["words alone, as no date", { performedString: "Spring 2019" }, ""],
    ["a year written as text", { performedString: "2019" }, "2019"],
    ["a month written as text", { performedString: "2019-05" }, "May 2019"],
    [
      "a time written as text, on the patient's own calendar day",
      { performedString: "2024-03-13T03:30:00Z" },
      "March 12, 2024",
    ],
    ["an age, as no date", { performedAge: { value: 40, unit: "a" } }, ""],
    [
      "a range of ages, as no date",
      { performedRange: { low: { value: 40 }, high: { value: 45 } } },
      "",
    ],
    ["nothing, as no date", {}, ""],
  ])("dates a procedure performed at %s", (_, performed, date) => {
    showDatesInChicago();

    expect(summarizeSkinBiopsy(performed).date).toBe(date);
  });

  it("has no verification or value, which a procedure does not record", () => {
    expect(summarizeSkinBiopsy({})).toMatchObject({
      value: "",
      verification: "",
    });
  });
});

describe("summarizeImmunization", () => {
  const statusWords = {
    [IMMUNIZATION_STATUS.COMPLETED]: "Completed",
    [IMMUNIZATION_STATUS.ENTERED_IN_ERROR]: "Entered in error",
    [IMMUNIZATION_STATUS.NOT_DONE]: "Not given",
  } satisfies Record<Immunization["status"], string>;

  it.each(Object.entries(statusWords))(
    "words the status %s as %s, so a vaccine not given never reads as given",
    (status, words) => {
      expect(
        summarizeInfluenzaVaccine({
          status: status as Immunization["status"],
        }).status,
      ).toBe(words);
    },
  );

  it.each([
    [IMMUNIZATION_STATUS.COMPLETED, true, "Subpotent dose"],
    [IMMUNIZATION_STATUS.COMPLETED, false, "Completed"],
    [IMMUNIZATION_STATUS.COMPLETED, undefined, "Completed"],
    [IMMUNIZATION_STATUS.NOT_DONE, true, "Not given"],
    [IMMUNIZATION_STATUS.ENTERED_IN_ERROR, true, "Entered in error"],
  ])(
    "words a dose with the status %s that is subpotent %s as %s",
    (status, isSubpotent, words) => {
      expect(summarizeInfluenzaVaccine({ status, isSubpotent }).status).toBe(
        words,
      );
    },
  );

  it("names everyone who gave or ordered a vaccine, in the clinic's order, leaving out one recorded with no name", () => {
    expect(
      summarizeInfluenzaVaccine({
        performer: [
          { actor: { display: "Dr. Mira Synthetic" } },
          { actor: { reference: `${RESOURCE_TYPE.PRACTITIONER}/unnamed` } },
          { actor: { display: "" } },
          { actor: { display: "Nurse Ana Synthetic" } },
        ],
      }).author,
    ).toBe("Dr. Mira Synthetic, Nurse Ana Synthetic");
  });

  it("names someone listed more than once, in several roles or through their role, only once", () => {
    expect(
      summarizeInfluenzaVaccine({
        performer: [
          {
            function: { text: "Ordering Provider" },
            actor: {
              reference: `${RESOURCE_TYPE.PRACTITIONER}/mira-synthetic`,
              display: "Dr. Mira Synthetic",
            },
          },
          { actor: { display: "Nurse Ana Synthetic" } },
          {
            function: { text: "Administering Provider" },
            actor: {
              reference: `${RESOURCE_TYPE.PRACTITIONER}/mira-synthetic`,
              display: "Dr. Mira Synthetic",
            },
          },
          {
            actor: {
              reference: `${RESOURCE_TYPE.PRACTITIONER_ROLE}/mira-synthetic-nurse`,
              display: "Dr. Mira Synthetic",
            },
          },
        ],
      }).author,
    ).toBe("Dr. Mira Synthetic, Nurse Ana Synthetic");
  });

  it("names a clinic recorded as giving the vaccine", () => {
    expect(
      summarizeInfluenzaVaccine({
        performer: [
          {
            actor: {
              reference: `${RESOURCE_TYPE.ORGANIZATION}/pine-family-clinic`,
              display: "Immunization service",
            },
          },
        ],
      }).author,
    ).toBe("Immunization service");
  });

  it("names no one when the clinic recorded no one giving the vaccine", () => {
    expect(summarizeInfluenzaVaccine({ performer: undefined }).author).toBe("");
  });

  it.each([
    ["a day", { occurrenceDateTime: "2025-10-06" }, "October 6, 2025"],
    ["a month", { occurrenceDateTime: "2025-10" }, "October 2025"],
    [
      "a time, on the patient's own calendar day",
      { occurrenceDateTime: "2025-10-07T03:30:00Z" },
      "October 6, 2025",
    ],
    [
      "a time written in another time zone, on the patient's own calendar day",
      { occurrenceDateTime: "2025-10-07T09:30:00+09:00" },
      "October 6, 2025",
    ],
    [
      "words alone, as no date",
      { occurrenceDateTime: undefined, occurrenceString: "Spring 2019" },
      "",
    ],
    [
      "a year written as text",
      { occurrenceDateTime: undefined, occurrenceString: "2019" },
      "2019",
    ],
    [
      "a month written as text",
      { occurrenceDateTime: undefined, occurrenceString: "2019-05" },
      "May 2019",
    ],
    [
      "a time written as text, on the patient's own calendar day",
      {
        occurrenceDateTime: undefined,
        occurrenceString: "2025-10-07T03:30:00Z",
      },
      "October 6, 2025",
    ],
  ])("dates a vaccine given at %s", (_, occurrence, date) => {
    showDatesInChicago();

    expect(summarizeInfluenzaVaccine(occurrence).date).toBe(date);
  });

  it("keeps each note the clinic wrote on a vaccine, in order, with its author and date where the note records them", () => {
    showDatesInChicago();

    expect(
      summarizeInfluenzaVaccine({
        note: [
          { text: "One historical influenza dose is recorded." },
          {
            authorString: "Nurse Ana Synthetic",
            time: "2025-10-06T15:00:00Z",
            text: "Taken from a written record.",
          },
        ],
      }).notes,
    ).toEqual([
      {
        author: "",
        date: "",
        text: "One historical influenza dose is recorded.",
      },
      {
        author: "Nurse Ana Synthetic",
        date: "October 6, 2025",
        text: "Taken from a written record.",
      },
    ]);
  });

  it.each([
    ["no note at all", undefined],
    ["an empty list of notes", []],
  ])(
    "keeps no notes for a vaccine the clinic wrote none on, given %s",
    (_, note) => {
      expect(summarizeInfluenzaVaccine({ note }).notes).toEqual([]);
    },
  );

  it("has no verification or value, which an immunization does not record", () => {
    expect(summarizeInfluenzaVaccine({})).toMatchObject({
      value: "",
      verification: "",
    });
  });
});

describe("summarizeAllergyIntolerance", () => {
  it.each([
    [
      "an active one",
      allergyClinical(ALLERGY_INTOLERANCE_CLINICAL_STATUS.ACTIVE),
      allergyVerification(ALLERGY_INTOLERANCE_VERIFICATION_STATUS.REFUTED),
    ],
    [
      "a resolved one",
      allergyClinical(ALLERGY_INTOLERANCE_CLINICAL_STATUS.RESOLVED),
      allergyVerification(ALLERGY_INTOLERANCE_VERIFICATION_STATUS.REFUTED),
    ],
    [
      "one with no clinical status",
      undefined,
      allergyVerification(ALLERGY_INTOLERANCE_VERIFICATION_STATUS.REFUTED),
    ],
    [
      "one whose verification is also coded in another system first",
      allergyClinical(ALLERGY_INTOLERANCE_CLINICAL_STATUS.ACTIVE),
      codedAlsoElsewhere(
        CODE_SYSTEM.ALLERGY_INTOLERANCE_VERIFICATION,
        ALLERGY_INTOLERANCE_VERIFICATION_STATUS.REFUTED,
      ),
    ],
  ])(
    "words an allergy the clinician ruled out as ruled out, even %s",
    (_, clinicalStatus, verificationStatus) => {
      const summary = summarizeAllergyStatus(
        clinicalStatus,
        verificationStatus,
      );

      expect(summary.status).toBe("Ruled out");
      expect(summary.verification).toBe("Refuted");
    },
  );

  it.each([
    [
      "an active one",
      allergyClinical(ALLERGY_INTOLERANCE_CLINICAL_STATUS.ACTIVE),
      allergyVerification(ALLERGY_INTOLERANCE_VERIFICATION_STATUS.UNCONFIRMED),
    ],
    [
      "one with no clinical status",
      undefined,
      allergyVerification(ALLERGY_INTOLERANCE_VERIFICATION_STATUS.UNCONFIRMED),
    ],
    [
      "one whose verification is also coded in another system first",
      allergyClinical(ALLERGY_INTOLERANCE_CLINICAL_STATUS.ACTIVE),
      codedAlsoElsewhere(
        CODE_SYSTEM.ALLERGY_INTOLERANCE_VERIFICATION,
        ALLERGY_INTOLERANCE_VERIFICATION_STATUS.UNCONFIRMED,
      ),
    ],
  ])(
    "words an unconfirmed allergy as unconfirmed, %s",
    (_, clinicalStatus, verificationStatus) => {
      const summary = summarizeAllergyStatus(
        clinicalStatus,
        verificationStatus,
      );

      expect(summary.status).toBe("Unconfirmed");
      expect(summary.verification).toBe("Unconfirmed");
    },
  );

  it.each([
    [
      "inactive",
      allergyClinical(ALLERGY_INTOLERANCE_CLINICAL_STATUS.INACTIVE),
      "Inactive",
    ],
    [
      "resolved",
      allergyClinical(ALLERGY_INTOLERANCE_CLINICAL_STATUS.RESOLVED),
      "Resolved",
    ],
    [
      "resolved, also coded in another system first,",
      codedAlsoElsewhere(
        CODE_SYSTEM.ALLERGY_INTOLERANCE_CLINICAL,
        ALLERGY_INTOLERANCE_CLINICAL_STATUS.RESOLVED,
      ),
      "Resolved",
    ],
  ])(
    "words an unconfirmed allergy whose clinical status is %s by that status, with its verification unconfirmed",
    (_, clinicalStatus, status) => {
      const summary = summarizeAllergyStatus(
        clinicalStatus,
        allergyVerification(
          ALLERGY_INTOLERANCE_VERIFICATION_STATUS.UNCONFIRMED,
        ),
      );

      expect(summary.status).toBe(status);
      expect(summary.verification).toBe("Unconfirmed");
    },
  );

  it.each([
    [
      "confirmed",
      allergyVerification(ALLERGY_INTOLERANCE_VERIFICATION_STATUS.CONFIRMED),
    ],
    ["not given", undefined],
    [
      "unconfirmed, but coded only in the clinic's own system",
      {
        coding: [
          {
            system: clinicVerification.system,
            code: ALLERGY_INTOLERANCE_VERIFICATION_STATUS.UNCONFIRMED,
          },
        ],
      },
    ],
  ])(
    "words an allergy by its clinical status when its verification is %s",
    (_, verificationStatus) => {
      expect(
        summarizeAllergyStatus(
          allergyClinical(ALLERGY_INTOLERANCE_CLINICAL_STATUS.ACTIVE),
          verificationStatus,
        ).status,
      ).toBe("Active");
    },
  );

  it("keeps each note the clinic wrote on an allergy, in order, with its author and date where the note records them", () => {
    showDatesInChicago();

    expect(
      summarizeAllergyNotes([
        { text: "Rash recorded after penicillin." },
        {
          authorString: "Nurse Ana Synthetic",
          time: "2025-03-12T15:00:00Z",
          text: "Reaction and verification need clinical review.",
        },
      ]),
    ).toEqual([
      { author: "", date: "", text: "Rash recorded after penicillin." },
      {
        author: "Nurse Ana Synthetic",
        date: "March 12, 2025",
        text: "Reaction and verification need clinical review.",
      },
    ]);
  });

  it.each([
    [
      "only when it was written",
      { time: "2025-03-12T15:00:00Z", text: "Rash recorded." },
      { author: "", date: "March 12, 2025", text: "Rash recorded." },
    ],
    [
      "its author only as a reference with no name",
      {
        authorReference: { reference: "Practitioner/synthetic" },
        text: "Rash recorded.",
      },
      { author: "", date: "", text: "Rash recorded." },
    ],
  ])("keeps no author for a note that records %s", (_, note, summary) => {
    showDatesInChicago();

    expect(summarizeAllergyNotes([note])).toEqual([summary]);
  });

  it("names who wrote a note from its reference when the clinic recorded one", () => {
    expect(
      summarizeAllergyNotes([
        {
          authorReference: { display: "Dr. Mira Synthetic" },
          text: "Rash recorded after penicillin.",
        },
      ]),
    ).toEqual([
      {
        author: "Dr. Mira Synthetic",
        date: "",
        text: "Rash recorded after penicillin.",
      },
    ]);
  });

  it.each([
    ["no note at all", undefined],
    ["an empty list of notes", []],
  ])(
    "keeps no notes for an allergy the clinic wrote none on, given %s",
    (_, note) => {
      expect(summarizeAllergyNotes(note)).toEqual([]);
    },
  );
});

describe("summarizeCondition", () => {
  it.each([
    [
      "an active one",
      conditionClinical(CONDITION_CLINICAL_STATUS.ACTIVE),
      conditionVerification(CONDITION_VERIFICATION_STATUS.REFUTED),
    ],
    [
      "an inactive one",
      conditionClinical(CONDITION_CLINICAL_STATUS.INACTIVE),
      conditionVerification(CONDITION_VERIFICATION_STATUS.REFUTED),
    ],
    [
      "one with no clinical status",
      undefined,
      conditionVerification(CONDITION_VERIFICATION_STATUS.REFUTED),
    ],
    [
      "one whose verification is also coded in another system first",
      conditionClinical(CONDITION_CLINICAL_STATUS.ACTIVE),
      codedAlsoElsewhere(
        CODE_SYSTEM.CONDITION_VERIFICATION,
        CONDITION_VERIFICATION_STATUS.REFUTED,
      ),
    ],
  ])(
    "words a condition the clinician ruled out as ruled out, even %s",
    (_, clinicalStatus, verificationStatus) => {
      const summary = summarizeConditionStatus(
        clinicalStatus,
        verificationStatus,
      );

      expect(summary.status).toBe("Ruled out");
      expect(summary.verification).toBe("Refuted");
    },
  );

  it.each([
    [
      "an active one",
      conditionClinical(CONDITION_CLINICAL_STATUS.ACTIVE),
      conditionVerification(CONDITION_VERIFICATION_STATUS.UNCONFIRMED),
      "Unconfirmed",
    ],
    [
      "a recurrence",
      conditionClinical(CONDITION_CLINICAL_STATUS.RECURRENCE),
      conditionVerification(CONDITION_VERIFICATION_STATUS.UNCONFIRMED),
      "Unconfirmed",
    ],
    [
      "a relapse",
      conditionClinical(CONDITION_CLINICAL_STATUS.RELAPSE),
      conditionVerification(CONDITION_VERIFICATION_STATUS.UNCONFIRMED),
      "Unconfirmed",
    ],
    [
      "one with no clinical status",
      undefined,
      conditionVerification(CONDITION_VERIFICATION_STATUS.UNCONFIRMED),
      "Unconfirmed",
    ],
    [
      "one whose verification is also coded in another system first",
      conditionClinical(CONDITION_CLINICAL_STATUS.ACTIVE),
      codedAlsoElsewhere(
        CODE_SYSTEM.CONDITION_VERIFICATION,
        CONDITION_VERIFICATION_STATUS.UNCONFIRMED,
      ),
      "Unconfirmed",
    ],
    [
      "a provisional one",
      conditionClinical(CONDITION_CLINICAL_STATUS.ACTIVE),
      conditionVerification(CONDITION_VERIFICATION_STATUS.PROVISIONAL),
      "Provisional",
    ],
    [
      "a differential one",
      conditionClinical(CONDITION_CLINICAL_STATUS.ACTIVE),
      conditionVerification(CONDITION_VERIFICATION_STATUS.DIFFERENTIAL),
      "Differential",
    ],
  ])(
    "words a condition that is unconfirmed, provisional or differential as unconfirmed, %s",
    (_, clinicalStatus, verificationStatus, verification) => {
      const summary = summarizeConditionStatus(
        clinicalStatus,
        verificationStatus,
      );

      expect(summary.status).toBe("Unconfirmed");
      expect(summary.verification).toBe(verification);
    },
  );

  it.each([
    [
      "inactive",
      CONDITION_VERIFICATION_STATUS.UNCONFIRMED,
      conditionClinical(CONDITION_CLINICAL_STATUS.INACTIVE),
      "Inactive",
      "Unconfirmed",
    ],
    [
      "resolved",
      CONDITION_VERIFICATION_STATUS.UNCONFIRMED,
      conditionClinical(CONDITION_CLINICAL_STATUS.RESOLVED),
      "Resolved",
      "Unconfirmed",
    ],
    [
      "remission",
      CONDITION_VERIFICATION_STATUS.UNCONFIRMED,
      conditionClinical(CONDITION_CLINICAL_STATUS.REMISSION),
      "Remission",
      "Unconfirmed",
    ],
    [
      "remission, also coded in another system first,",
      CONDITION_VERIFICATION_STATUS.UNCONFIRMED,
      codedAlsoElsewhere(
        CODE_SYSTEM.CONDITION_CLINICAL,
        CONDITION_CLINICAL_STATUS.REMISSION,
      ),
      "Remission",
      "Unconfirmed",
    ],
    [
      "resolved",
      CONDITION_VERIFICATION_STATUS.PROVISIONAL,
      conditionClinical(CONDITION_CLINICAL_STATUS.RESOLVED),
      "Resolved",
      "Provisional",
    ],
    [
      "remission",
      CONDITION_VERIFICATION_STATUS.DIFFERENTIAL,
      conditionClinical(CONDITION_CLINICAL_STATUS.REMISSION),
      "Remission",
      "Differential",
    ],
  ])(
    "words a condition whose clinical status is %s and whose verification is %s by that clinical status, with its verification kept",
    (_, verificationCode, clinicalStatus, status, verification) => {
      const summary = summarizeConditionStatus(
        clinicalStatus,
        conditionVerification(verificationCode),
      );

      expect(summary.status).toBe(status);
      expect(summary.verification).toBe(verification);
    },
  );

  it.each([
    [
      "confirmed",
      conditionVerification(CONDITION_VERIFICATION_STATUS.CONFIRMED),
    ],
    ["not given", undefined],
    [
      "unconfirmed, but coded only in the clinic's own system",
      {
        coding: [
          {
            system: clinicVerification.system,
            code: CONDITION_VERIFICATION_STATUS.UNCONFIRMED,
          },
        ],
      },
    ],
  ])(
    "words a condition by its clinical status when its verification is %s",
    (_, verificationStatus) => {
      expect(
        summarizeConditionStatus(
          conditionClinical(CONDITION_CLINICAL_STATUS.ACTIVE),
          verificationStatus,
        ).status,
      ).toBe("Active");
    },
  );
});

describe("where a health record came from", () => {
  const meta = { source: oakDermatology.address, lastUpdated: RECEIVED_AT };
  const oakSourceNames = new RecordSourceNames([
    [oakDermatology.address, oakDermatology.name],
  ]);
  const summarizers = [
    [
      "a condition",
      (
        withMeta: typeof meta | undefined,
        recordSourceNames: RecordSourceNames,
      ) =>
        summarizeCondition(
          {
            resourceType: RESOURCE_TYPE.CONDITION,
            id: "eczema",
            subject: homer,
            meta: withMeta,
          },
          recordSourceNames,
        ),
    ],
    [
      "an allergy",
      (
        withMeta: typeof meta | undefined,
        recordSourceNames: RecordSourceNames,
      ) =>
        summarizeAllergyIntolerance(
          {
            resourceType: RESOURCE_TYPE.ALLERGY_INTOLERANCE,
            id: "penicillin",
            patient: homer,
            meta: withMeta,
          },
          recordSourceNames,
        ),
    ],
    [
      "a measurement",
      (
        withMeta: typeof meta | undefined,
        recordSourceNames: RecordSourceNames,
      ) =>
        summarizeVitalSign(
          {
            resourceType: RESOURCE_TYPE.OBSERVATION,
            id: "blood-pressure",
            status: OBSERVATION_STATUS.FINAL,
            code: { text: "Blood pressure" },
            meta: withMeta,
          },
          recordSourceNames,
        ),
    ],
    [
      "a procedure",
      (
        withMeta: typeof meta | undefined,
        recordSourceNames: RecordSourceNames,
      ) =>
        summarizeProcedure(
          {
            resourceType: RESOURCE_TYPE.PROCEDURE,
            id: "skin-biopsy",
            status: PROCEDURE_STATUS.COMPLETED,
            subject: homer,
            meta: withMeta,
          },
          recordSourceNames,
        ),
    ],
    [
      "an immunization",
      (
        withMeta: typeof meta | undefined,
        recordSourceNames: RecordSourceNames,
      ) =>
        summarizeImmunization(
          {
            resourceType: RESOURCE_TYPE.IMMUNIZATION,
            id: "influenza-vaccine",
            status: IMMUNIZATION_STATUS.COMPLETED,
            patient: homer,
            vaccineCode: { text: "Influenza vaccine" },
            occurrenceDateTime: "2025-10-06",
            meta: withMeta,
          },
          recordSourceNames,
        ),
    ],
  ] as const;

  it.each(summarizers)(
    "names the source of %s and words when the portal received it, in the patient's time zone",
    (_kind, summarize) => {
      showDatesInChicago();

      expect(summarize(meta, oakSourceNames)).toMatchObject({
        received: "October 28, 2026 · 4:10 PM Central Time",
        source: oakDermatology.name,
      });
    },
  );

  it.each(summarizers)(
    "names no source for %s whose source the patient's sources do not name",
    (_kind, summarize) => {
      expect(summarize(meta, noSourceNames)).toMatchObject({ source: "" });
    },
  );

  it.each(summarizers)(
    "names no source and no received date for %s that names neither",
    (_kind, summarize) => {
      expect(summarize(undefined, oakSourceNames)).toMatchObject({
        received: "",
        source: "",
      });
    },
  );

  it.each(summarizers)(
    "words no received time for %s whose last update is not a valid time",
    (_kind, summarize) => {
      expect(
        summarize(
          { ...meta, lastUpdated: "2026-10-28T99:00:00Z" },
          oakSourceNames,
        ),
      ).toMatchObject({ received: "" });
    },
  );
});
