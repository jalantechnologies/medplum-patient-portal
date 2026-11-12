import {
  createReference,
  getReferenceString,
  type WithId,
} from "@medplum/core";
import type { DiagnosticReport, Observation } from "@medplum/fhirtypes";
import { HomerSimpson } from "@medplum/mock";
import { describe, expect, it } from "vitest";

import {
  CODE_SYSTEM,
  CONTAINED_REFERENCE_PREFIX,
  DIAGNOSTIC_REPORT_KIND,
  DIAGNOSTIC_REPORT_STATUS,
  OBSERVATION_INTERPRETATION,
  OBSERVATION_INTERPRETATION_VERSION_TWO,
  OBSERVATION_STATUS,
  REFERENCE_HISTORY_SEGMENT,
  RESOURCE_TYPE,
} from "../../constants/fhir";
import { showDatesInChicago } from "../../test-time-zone";
import type { DiagnosticReportKind } from "../../types";
import { summarizeDiagnosticReport } from "./test-report-summary";

const homer = createReference(HomerSimpson);

const buildResult = (
  id: string,
  overrides: Partial<Observation> = {},
): WithId<Observation> => ({
  resourceType: RESOURCE_TYPE.OBSERVATION,
  id,
  status: OBSERVATION_STATUS.FINAL,
  code: { text: id },
  subject: homer,
  ...overrides,
});

const containedReference = ({ id }: Observation) => ({
  reference: `${CONTAINED_REFERENCE_PREFIX}${id}`,
});

const summarize = (
  overrides: Partial<DiagnosticReport>,
  sharedResults: WithId<Observation>[] = [],
  kind: DiagnosticReportKind = DIAGNOSTIC_REPORT_KIND.LABORATORY,
) =>
  summarizeDiagnosticReport(kind)(
    {
      resourceType: RESOURCE_TYPE.DIAGNOSTIC_REPORT,
      id: "vitamin-d",
      status: DIAGNOSTIC_REPORT_STATUS.FINAL,
      code: { text: "Vitamin D" },
      subject: homer,
      ...overrides,
    },
    {
      nextPosition: null,
      resources: [],
      results: new Map(sharedResults.map((result) => [result.id, result])),
    },
  );

const summarizeOnlyResult = (overrides: Partial<Observation>) => {
  const result = buildResult("result", overrides);
  const [resultSummary] = summarize({ result: [createReference(result)] }, [
    result,
  ]).results;
  return resultSummary;
};

const listTestsByDepth = (report: ReturnType<typeof summarize>) =>
  report.results.map(({ depth, test }) => [depth, test]);

describe("summarizeDiagnosticReport", () => {
  it.each([
    ["its text", { text: "Vitamin D" }, "Vitamin D"],
    [
      "the first coding that has a name, when its code has no text",
      {
        coding: [
          { code: "62292-8" },
          { code: "1989-3", display: "Vitamin D3" },
          { code: "14635-7", display: "Vitamin D2" },
        ],
      },
      "Vitamin D3",
    ],
    [
      "a plain word, when nothing names it",
      { coding: [{ code: "1989-3" }] },
      "Test report",
    ],
  ])("names a report by %s", (_, code, title) => {
    expect(summarize({ code }).title).toBe(title);
  });

  it("dates a report by when it was taken: the time itself, else the start of the period, else its end", () => {
    expect(summarize({ effectiveDateTime: "2026-10-18" }).date).toBe(
      "Collected October 18, 2026",
    );
    expect(
      summarize({
        effectivePeriod: { start: "2026-10-17", end: "2026-10-18" },
      }).date,
    ).toBe("Collected October 17, 2026");
    expect(summarize({ effectivePeriod: { end: "2026-10-18" } }).date).toBe(
      "Collected October 18, 2026",
    );
    expect(summarize({}).date).toBe("");
  });

  it.each([
    [DIAGNOSTIC_REPORT_KIND.LABORATORY, "Collected October 18, 2026"],
    [DIAGNOSTIC_REPORT_KIND.IMAGING, "Performed October 18, 2026"],
    [DIAGNOSTIC_REPORT_KIND.OTHER, "October 18, 2026"],
  ])("words the date of a %s report", (kind, date) => {
    expect(summarize({ effectiveDateTime: "2026-10-18" }, [], kind).date).toBe(
      date,
    );
  });

  it("names the first performer that has a name", () => {
    expect(
      summarize({
        performer: [
          { identifier: { value: "harbor-synthetic-imaging" } },
          { display: "Harbor Synthetic Imaging" },
        ],
      }).performer,
    ).toBe("Harbor Synthetic Imaging");
    expect(summarize({}).performer).toBe("");
  });

  it("words the status and keeps the conclusion as written", () => {
    expect(
      summarize({
        status: DIAGNOSTIC_REPORT_STATUS.PRELIMINARY,
        conclusion: "No acute cardiopulmonary abnormality.",
      }),
    ).toEqual(
      expect.objectContaining({
        conclusion: "No acute cardiopulmonary abnormality.",
        status: "Preliminary",
      }),
    );
  });

  it("lists the report's results in its own order, and only those that came with it", () => {
    const glucose = buildResult("glucose");
    const sodium = buildResult("sodium");
    const otherReportResult = buildResult("other-report-result");

    expect(
      summarize(
        {
          result: [
            createReference(sodium),
            { reference: `${RESOURCE_TYPE.OBSERVATION}/not-shared` },
            {},
            createReference(glucose),
          ],
        },
        [glucose, otherReportResult, sodium],
      ).results.map(({ test }) => test),
    ).toEqual(["sodium", "glucose"]);
  });

  it("lists a result kept elsewhere than Medplum by its name, as not available here", () => {
    const glucose = buildResult("glucose");

    expect(
      summarize(
        {
          result: [
            {
              reference: `https://example.org/fhir/${RESOURCE_TYPE.OBSERVATION}/hemoglobin`,
              display: "Hemoglobin",
            },
            {
              identifier: {
                system: "http://example.org/results",
                value: "potassium-1",
              },
            },
            createReference(glucose),
          ],
        },
        [glucose],
      ).results.map(({ test, value }) => [test, value]),
    ).toEqual([
      ["Hemoglobin", "Not available here"],
      ["Test", "Not available here"],
      ["glucose", "No value"],
    ]);
  });

  it("says whether the report comes as a document", () => {
    expect(
      summarize({
        presentedForm: [
          {
            contentType: "application/pdf",
            url: "https://example.org/report.pdf",
          },
        ],
      }).hasDocument,
    ).toBe(true);
    expect(summarize({}).hasDocument).toBe(false);
  });

  it("finds a result the report points to by one of its versions", () => {
    const glucose = buildResult("glucose");

    expect(
      summarize(
        {
          result: [
            {
              reference: `${getReferenceString(glucose)}/${REFERENCE_HISTORY_SEGMENT}/2`,
            },
          ],
        },
        [glucose],
      ).results.map(({ test }) => test),
    ).toEqual(["glucose"]);
  });

  it("finds a result kept inside the report, and leaves it out when it was entered in error", () => {
    const glucose = buildResult("glucose");
    const mistakenResult = buildResult("calcium", {
      status: OBSERVATION_STATUS.ENTERED_IN_ERROR,
    });

    expect(
      summarize({
        contained: [glucose, mistakenResult],
        result: [
          containedReference(glucose),
          containedReference(mistakenResult),
        ],
      }).results.map(({ test }) => test),
    ).toEqual(["glucose"]);
  });

  it("lists a panel's own results under it, a level deeper, with no value for the panel itself", () => {
    const hemoglobin = buildResult("hemoglobin");
    const neutrophils = buildResult("neutrophils");
    const differential = buildResult("differential", {
      hasMember: [createReference(neutrophils)],
    });
    const bloodCount = buildResult("blood-count", {
      hasMember: [createReference(hemoglobin), createReference(differential)],
    });

    const report = summarize({ result: [createReference(bloodCount)] }, [
      bloodCount,
      differential,
      hemoglobin,
      neutrophils,
    ]);

    expect(listTestsByDepth(report)).toEqual([
      [0, "blood-count"],
      [1, "hemoglobin"],
      [1, "differential"],
      [2, "neutrophils"],
    ]);
    expect(report.results[0].value).toBe("");
  });

  it("lists the results of a panel kept inside the report, and of a shared panel, from where each keeps them", () => {
    const sodium = buildResult("sodium");
    const potassium = buildResult("potassium");
    const sharedPanel = buildResult("shared-panel", {
      contained: [potassium],
      hasMember: [containedReference(potassium)],
    });
    const containedPanel = buildResult("contained-panel", {
      hasMember: [containedReference(sodium), createReference(sharedPanel)],
    });

    expect(
      listTestsByDepth(
        summarize(
          {
            contained: [containedPanel, sodium],
            result: [containedReference(containedPanel)],
          },
          [sharedPanel],
        ),
      ),
    ).toEqual([
      [0, "contained-panel"],
      [1, "sodium"],
      [1, "shared-panel"],
      [2, "potassium"],
    ]);
  });

  it("lists a panel that holds itself only once", () => {
    const panel = buildResult("panel", {
      hasMember: [
        { reference: `${RESOURCE_TYPE.OBSERVATION}/panel` },
        { reference: `${RESOURCE_TYPE.OBSERVATION}/glucose` },
      ],
    });

    expect(
      listTestsByDepth(
        summarize({ result: [createReference(panel)] }, [
          panel,
          buildResult("glucose"),
        ]),
      ),
    ).toEqual([
      [0, "panel"],
      [1, "glucose"],
    ]);
  });

  it.each([
    [
      "a quantity with its unit",
      { valueQuantity: { value: 24, unit: "ng/mL" } },
      "24 ng/mL",
    ],
    [
      "a coded value",
      { valueCodeableConcept: { text: "Negative" } },
      "Negative",
    ],
    ["text", { valueString: "Clear, yellow" }, "Clear, yellow"],
    ["a whole number", { valueInteger: 0 }, "0"],
    ["yes", { valueBoolean: true }, "Yes"],
    ["no", { valueBoolean: false }, "No"],
    [
      "a ratio, such as a titer",
      { valueRatio: { numerator: { value: 1 }, denominator: { value: 64 } } },
      "1:64",
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
      "a period of calendar days, on the days written",
      { valuePeriod: { start: "2026-10-18", end: "2026-10-20" } },
      "October 18, 2026 - October 20, 2026",
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
    ["a time of day, as written", { valueTime: "07:30:00" }, "7:30 AM"],
    [
      "that a device recording is not shown",
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
    [
      "why there is none",
      { dataAbsentReason: { coding: [{ display: "Not performed" }] } },
      "Not performed",
    ],
    ["that there is none", {}, "No value"],
  ])("shows %s as the value", (_, overrides, value) => {
    showDatesInChicago();

    expect(summarizeOnlyResult(overrides).value).toBe(value);
  });

  it("lists each part of a multi-part result under it, a level deeper, with the part's own value, reference range and flag, after the result's own value", () => {
    showDatesInChicago();
    const bloodPressure = buildResult("blood-pressure", {
      component: [
        {
          code: { text: "Systolic" },
          valueQuantity: { value: 142, unit: "mmHg" },
          referenceRange: [{ high: { value: 120, unit: "mmHg" } }],
          interpretation: [{ coding: [OBSERVATION_INTERPRETATION.HIGH] }],
        },
        {
          code: { text: "Diastolic" },
          dataAbsentReason: { text: "Cuff slipped" },
        },
        { code: { text: "Readings taken" }, valueInteger: 3 },
        { code: { text: "Taken on" }, valueDateTime: "2026-10-18" },
      ],
    });
    const urineCulture = buildResult("urine-culture", {
      valueInteger: 7,
      component: [
        {
          code: { text: "Colony count" },
          valueQuantity: { value: 100000, unit: "CFU/mL" },
        },
      ],
    });

    const { results } = summarize(
      {
        result: [createReference(bloodPressure), createReference(urineCulture)],
      },
      [bloodPressure, urineCulture],
    );

    expect(
      results.map(({ depth, flag, referenceRanges, test, value }) => [
        depth,
        test,
        value,
        referenceRanges,
        flag,
      ]),
    ).toEqual([
      [0, "blood-pressure", "", [], ""],
      [1, "Systolic", "142 mmHg", ["<= 120 mmHg"], "High"],
      [1, "Diastolic", "Cuff slipped", [], ""],
      [1, "Readings taken", "3", [], ""],
      [1, "Taken on", "October 18, 2026", [], ""],
      [0, "urine-culture", "7", [], ""],
      [1, "Colony count", "100000 CFU/mL", [], ""],
    ]);
  });

  it("shows a result's status unless it is final", () => {
    expect(summarizeOnlyResult({}).status).toBe("");
    expect(
      [
        OBSERVATION_STATUS.PRELIMINARY,
        OBSERVATION_STATUS.CORRECTED,
        OBSERVATION_STATUS.CANCELLED,
      ].map((status) => summarizeOnlyResult({ status }).status),
    ).toEqual(["Preliminary", "Corrected", "Cancelled"]);
  });

  it.each([
    [
      "its text first",
      [{ text: "Under 200 mg/dL", high: { value: 200, unit: "mg/dL" } }],
      ["Under 200 mg/dL"],
    ],
    [
      "both ends",
      [
        {
          low: { value: 30, unit: "ng/mL" },
          high: { value: 100, unit: "ng/mL" },
        },
      ],
      ["30 - 100 ng/mL"],
    ],
    [
      "a lower end only",
      [{ low: { value: 12, unit: "ng/mL" } }],
      [">= 12 ng/mL"],
    ],
    ["an upper end only", [{ high: { value: 5.7, unit: "%" } }], ["<= 5.7%"]],
    [
      "each of several ranges",
      [{ text: "Women: 12 to 150 ng/mL" }, { text: "Men: 30 to 400 ng/mL" }],
      ["Women: 12 to 150 ng/mL", "Men: 30 to 400 ng/mL"],
    ],
    [
      "the kind of range, whom it applies to and at what age",
      [
        {
          low: { value: 13.5, unit: "g/dL" },
          high: { value: 17.5, unit: "g/dL" },
          type: { text: "Normal range" },
          appliesTo: [{ text: "Male" }],
          age: {
            low: { value: 18, unit: "years" },
            high: { value: 65, unit: "years" },
          },
        },
        {
          low: { value: 12, unit: "g/dL" },
          high: { value: 15.5, unit: "g/dL" },
          appliesTo: [{ coding: [{ display: "Female" }] }],
        },
      ],
      [
        "Normal range, Male, 18 - 65 years: 13.5 - 17.5 g/dL",
        "Female: 12 - 15.5 g/dL",
      ],
    ],
    ["nothing when a range has no ends and no text", [{}], []],
  ])("shows a reference range by %s", (_, referenceRange, referenceRanges) => {
    expect(summarizeOnlyResult({ referenceRange }).referenceRanges).toEqual(
      referenceRanges,
    );
  });

  it("names each flag the lab sent: its own name, else HL7's name for its code in either HL7 code system, else the code itself", () => {
    expect(
      summarizeOnlyResult({
        interpretation: [
          {
            coding: [
              {
                code: OBSERVATION_INTERPRETATION.LOW.code,
                display: OBSERVATION_INTERPRETATION.LOW.display,
              },
            ],
          },
          { text: "Critical" },
          {
            coding: [
              {
                system: CODE_SYSTEM.OBSERVATION_INTERPRETATION,
                code: OBSERVATION_INTERPRETATION.SIGNIFICANTLY_HIGH.code,
              },
            ],
          },
          {
            coding: [
              {
                system: CODE_SYSTEM.OBSERVATION_INTERPRETATION_VERSION_TWO,
                code: OBSERVATION_INTERPRETATION.REACTIVE.code,
              },
            ],
          },
          { coding: [{ code: OBSERVATION_INTERPRETATION.ABNORMAL.code }] },
          {},
        ],
      }).flag,
    ).toBe(
      [
        OBSERVATION_INTERPRETATION.LOW.display,
        "Critical",
        OBSERVATION_INTERPRETATION.SIGNIFICANTLY_HIGH.display,
        OBSERVATION_INTERPRETATION.REACTIVE.display,
        OBSERVATION_INTERPRETATION.ABNORMAL.code,
      ].join(", "),
    );
    expect(summarizeOnlyResult({}).flag).toBe("");
  });

  it("names the flags HL7 has since deprecated, and the one code of version 2 that version 3 lacks", () => {
    const codeIn = (system: string, code: string) => ({
      coding: [{ system, code }],
    });

    expect(
      summarizeOnlyResult({
        interpretation: [
          codeIn(
            CODE_SYSTEM.OBSERVATION_INTERPRETATION,
            OBSERVATION_INTERPRETATION.DEPRECATED_SIGNIFICANTLY_HIGH.code,
          ),
          codeIn(
            CODE_SYSTEM.OBSERVATION_INTERPRETATION_VERSION_TWO,
            OBSERVATION_INTERPRETATION.MODERATELY_SUSCEPTIBLE.code,
          ),
          codeIn(
            CODE_SYSTEM.OBSERVATION_INTERPRETATION_VERSION_TWO,
            OBSERVATION_INTERPRETATION.QUALITY_CONTROL_FAILURE.code,
          ),
          codeIn(
            CODE_SYSTEM.OBSERVATION_INTERPRETATION_VERSION_TWO,
            OBSERVATION_INTERPRETATION_VERSION_TWO.NO_RANGE_DEFINED.code,
          ),
        ],
      }).flag,
    ).toBe(
      [
        OBSERVATION_INTERPRETATION.DEPRECATED_SIGNIFICANTLY_HIGH.display,
        OBSERVATION_INTERPRETATION.MODERATELY_SUSCEPTIBLE.display,
        OBSERVATION_INTERPRETATION.QUALITY_CONTROL_FAILURE.display,
        OBSERVATION_INTERPRETATION_VERSION_TWO.NO_RANGE_DEFINED.display,
      ].join(", "),
    );
  });

  it("names a result by its first named coding", () => {
    expect(
      summarizeOnlyResult({
        code: {
          coding: [
            { code: "2345-7" },
            {
              code: "2345-7",
              display: "Glucose [Mass/volume] in Serum or Plasma",
            },
          ],
        },
      }).test,
    ).toBe("Glucose [Mass/volume] in Serum or Plasma");
    expect(
      summarizeOnlyResult({ code: { coding: [{ code: "2345-7" }] } }).test,
    ).toBe("Test");
  });
});
