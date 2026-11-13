import {
  createReference,
  getReferenceString,
  getSearchParameter,
  Operator,
  type Filter,
  type SearchRequest,
} from "@medplum/core";
import type { Observation, Patient } from "@medplum/fhirtypes";
import { HomerDiagnosticReport, HomerSimpson, MockClient } from "@medplum/mock";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, type MockInstance } from "vitest";

import constant from "../../constants";
import {
  CODE_SYSTEM,
  CONTAINED_REFERENCE_PREFIX,
  DIAGNOSTIC_REPORT_CATEGORY,
  DIAGNOSTIC_REPORT_NOTE_CATEGORY,
  DIAGNOSTIC_REPORT_STATUS,
  IMAGING_SERVICE_SECTION,
  LABORATORY_SERVICE_SECTION,
  OBSERVATION_INTERPRETATION,
  OBSERVATION_STATUS,
  REFERENCE_HISTORY_SEGMENT,
  RESOURCE_TYPE,
  SEARCH_PARAMETER,
  SEARCH_VALUE_SEPARATOR,
} from "../../constants/fhir";
import { DiagnosticReportProvider } from "../../providers";
import {
  codeFrom,
  createDiagnosticReport,
  createReportResult,
  failSearches,
  laboratory,
  readSearchRequest,
} from "../../test-medplum";
import { TestProviders } from "../../test-providers";
import { showDatesInChicago } from "../../test-time-zone";
import TestResults from "./test-results.page";

const homer = createReference(HomerSimpson);
const LABORATORY_RESULTS = "laboratory-results";
const IMAGING = "imaging";
const OTHER_REPORTS = "other-reports";
const MISSING_REPORT_NOTICE =
  "The source may not have shared a report, or this type of test may not have been ordered.";

const radiology = codeFrom(
  CODE_SYSTEM.DIAGNOSTIC_SERVICE_SECTION,
  IMAGING_SERVICE_SECTION.RADIOLOGY,
);

const createMedplumWithoutSampleReport = async () => {
  const medplum = new MockClient({ profile: HomerSimpson });
  await medplum.deleteResource(
    RESOURCE_TYPE.DIAGNOSTIC_REPORT,
    HomerDiagnosticReport.id as string,
  );
  return medplum;
};

const renderTestResults = (medplum: MockClient) =>
  render(
    <TestProviders medplum={medplum}>
      <DiagnosticReportProvider>
        <TestResults />
      </DiagnosticReportProvider>
    </TestProviders>,
  );

const openTab = async (
  user: ReturnType<typeof userEvent.setup>,
  tabKey: string,
) => {
  await user.click(screen.getByTestId(`${tabKey}-tab`));
  return screen.getByTestId(`${tabKey}-panel`);
};

const listReportTitles = (container: HTMLElement, tabKey: string) =>
  within(container)
    .getAllByTestId(`${tabKey}-record-title`)
    .map((title) => title.textContent);

const listResultCells = (report: HTMLElement, tabKey: string) =>
  within(report)
    .getAllByTestId(`${tabKey}-record-result`)
    .map((row) =>
      within(row)
        .getAllByTestId(`${tabKey}-record-result-cell`)
        .map((cell) => cell.textContent),
    );

const parseSearchRequests = (
  medplum: MockClient,
  searchResources: MockInstance<MockClient["searchResources"]>,
) =>
  searchResources.mock.calls.map(([resourceType, query]) =>
    readSearchRequest(medplum, resourceType, query),
  );

const findFilterValues = ({ filters }: SearchRequest, code: string) =>
  (filters ?? [])
    .filter((filter) => filter.code === code)
    .map(({ operator, value }) => ({ operator, value }));

describe("Test results", () => {
  it("shows whose record it is, the title, and a tab for lab results, imaging and other reports with lab results open", async () => {
    renderTestResults(new MockClient({ profile: HomerSimpson }));

    expect(screen.getByTestId("test-results-record-owner")).toHaveTextContent(
      "Your record · Homer Simpson",
    );
    expect(screen.getByTestId("test-results")).toHaveTextContent(
      "Test resultsLab reports, imaging, and other results.",
    );
    expect(
      [LABORATORY_RESULTS, IMAGING, OTHER_REPORTS].map(
        (tabKey) => screen.getByTestId(`${tabKey}-tab`).textContent,
      ),
    ).toEqual(["Lab results", "Imaging", "Other reports"]);
    expect(screen.getByTestId(`${LABORATORY_RESULTS}-tab`)).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      await screen.findByTestId(`${LABORATORY_RESULTS}-empty`),
    ).toBeInTheDocument();
  });

  it("shows loading until the reports arrive", async () => {
    renderTestResults(new MockClient({ profile: HomerSimpson }));

    expect(
      screen.getByTestId(`${LABORATORY_RESULTS}-loading`),
    ).toHaveTextContent("Loading…");
    expect(
      await screen.findByTestId(`${LABORATORY_RESULTS}-empty`),
    ).toBeInTheDocument();
  });

  it("lists the patient's lab reports newest first, each with when it was collected, the lab, its status and each result with its value, reference range and flag", async () => {
    showDatesInChicago();
    const medplum = new MockClient({ profile: HomerSimpson });
    const hemoglobin = await createReportResult(medplum, "Hemoglobin", {
      valueQuantity: { value: 14.2, unit: "g/dL" },
      referenceRange: [
        {
          low: { value: 13.5, unit: "g/dL" },
          high: { value: 17.5, unit: "g/dL" },
        },
      ],
      interpretation: [{ coding: [OBSERVATION_INTERPRETATION.NORMAL] }],
    });
    await createDiagnosticReport(medplum, "Hemoglobin", "2025-05-14", [
      hemoglobin,
    ]);
    const vitaminD = await createReportResult(medplum, "Vitamin D", {
      valueQuantity: { value: 24, unit: "ng/mL" },
      referenceRange: [
        {
          low: { value: 30, unit: "ng/mL" },
          high: { value: 100, unit: "ng/mL" },
        },
      ],
      interpretation: [{ coding: [OBSERVATION_INTERPRETATION.LOW] }],
    });
    await createDiagnosticReport(
      medplum,
      "Vitamin D",
      "2026-10-18T22:30:00-05:00",
      [vitaminD],
    );

    renderTestResults(medplum);

    const list = await screen.findByTestId(`${LABORATORY_RESULTS}-list`);
    const [newest, oldest] = within(list).getAllByTestId(
      `${LABORATORY_RESULTS}-record`,
    );
    expect(listReportTitles(list, LABORATORY_RESULTS)).toEqual([
      "Vitamin D",
      "Hemoglobin",
    ]);
    expect(
      within(newest).getByTestId(`${LABORATORY_RESULTS}-record-byline`),
    ).toHaveTextContent(`Collected October 18, 2026 · ${laboratory.display}`);
    expect(
      within(newest).getByTestId(`${LABORATORY_RESULTS}-record-status`),
    ).toHaveTextContent("Final");
    expect(listResultCells(newest, LABORATORY_RESULTS)).toEqual([
      ["Vitamin D", "24 ng/mL", "30 - 100 ng/mL", "Low"],
    ]);
    expect(listResultCells(oldest, LABORATORY_RESULTS)).toEqual([
      ["Hemoglobin", "14.2 g/dL", "13.5 - 17.5 g/dL", "Normal"],
    ]);
    expect(
      within(newest)
        .getAllByTestId(`${LABORATORY_RESULTS}-record-result-heading`)
        .map((heading) => heading.textContent),
    ).toEqual(["Test", "Result", "Reference range", "Flag"]);
    expect(
      within(newest).getByTestId(`${LABORATORY_RESULTS}-record-notice`),
    ).toHaveTextContent(
      "A reference range helps put this value in context. A flag alone does not diagnose a condition, and an in-range result does not rule out all illness.",
    );
    const results = within(newest).getByTestId(
      `${LABORATORY_RESULTS}-record-results`,
    );
    expect(results).toHaveAttribute("role", "region");
    expect(results).toHaveAccessibleName("Vitamin D results");
    expect(results).toHaveAttribute("tabindex", "0");
    expect(list.tagName).toBe("UL");
    expect(newest.tagName).toBe("LI");
    expect(
      within(newest).getByTestId(`${LABORATORY_RESULTS}-record-title`).tagName,
    ).toBe("H2");
  });

  it("lists a report's results in the report's own order", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    const sodium = await createReportResult(medplum, "Sodium");
    const glucose = await createReportResult(medplum, "Glucose");
    const potassium = await createReportResult(medplum, "Potassium");
    await createDiagnosticReport(
      medplum,
      "Basic metabolic panel",
      "2026-10-18",
      [glucose, sodium, potassium],
    );

    renderTestResults(medplum);

    const list = await screen.findByTestId(`${LABORATORY_RESULTS}-list`);
    expect(
      listResultCells(list, LABORATORY_RESULTS).map(([test]) => test),
    ).toEqual(["Glucose", "Sodium", "Potassium"]);
  });

  it("lists reports with no date after the dated ones, each with its results", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    await createDiagnosticReport(medplum, "Hemoglobin", "2025-05-14", [
      await createReportResult(medplum, "Hemoglobin"),
    ]);
    await createDiagnosticReport(medplum, "Old lipid panel", undefined, [
      await createReportResult(medplum, "LDL cholesterol"),
    ]);
    await createDiagnosticReport(medplum, "Vitamin D", "2026-10-18", [
      await createReportResult(medplum, "Vitamin D"),
    ]);

    renderTestResults(medplum);

    const list = await screen.findByTestId(`${LABORATORY_RESULTS}-list`);
    expect(listReportTitles(list, LABORATORY_RESULTS)).toEqual([
      "Vitamin D",
      "Hemoglobin",
      "Old lipid panel",
    ]);
    expect(
      within(list)
        .getAllByTestId(`${LABORATORY_RESULTS}-record`)
        .map((report) =>
          listResultCells(report, LABORATORY_RESULTS).map(([test]) => test),
        ),
    ).toEqual([["Vitamin D"], ["Hemoglobin"], ["LDL cholesterol"]]);
  });

  it("shows only the signed-in patient's reports", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    const otherPatient = await medplum.createResource<Patient>({
      resourceType: RESOURCE_TYPE.PATIENT,
      name: [{ given: ["Harper"], family: "Synthetic" }],
    });
    await createDiagnosticReport(
      medplum,
      "Another patient's hemoglobin",
      "2026-10-19",
      [],
      { subject: createReference(otherPatient) },
    );
    await createDiagnosticReport(medplum, "Vitamin D", "2026-10-18", []);

    renderTestResults(medplum);

    const list = await screen.findByTestId(`${LABORATORY_RESULTS}-list`);
    expect(listReportTitles(list, LABORATORY_RESULTS)).toEqual(["Vitamin D"]);
  });

  it.each([
    [
      "a lab report",
      "Complete blood count",
      [
        codeFrom(
          CODE_SYSTEM.DIAGNOSTIC_SERVICE_SECTION,
          LABORATORY_SERVICE_SECTION.LABORATORY,
        ),
        codeFrom(
          CODE_SYSTEM.DIAGNOSTIC_SERVICE_SECTION,
          LABORATORY_SERVICE_SECTION.HEMATOLOGY,
        ),
      ],
      LABORATORY_RESULTS,
    ],
    [
      "a report of a lab section alone",
      "Urinalysis",
      [
        codeFrom(
          CODE_SYSTEM.DIAGNOSTIC_SERVICE_SECTION,
          LABORATORY_SERVICE_SECTION.URINALYSIS,
        ),
      ],
      LABORATORY_RESULTS,
    ],
    [
      "a pathology note",
      "Skin biopsy",
      [codeFrom(CODE_SYSTEM.LOINC, DIAGNOSTIC_REPORT_NOTE_CATEGORY.PATHOLOGY)],
      LABORATORY_RESULTS,
    ],
    ["a radiology report", "XR Chest 2 Views", [radiology], IMAGING],
    [
      "a report of an imaging section alone",
      "CT Head",
      [
        codeFrom(
          CODE_SYSTEM.DIAGNOSTIC_SERVICE_SECTION,
          IMAGING_SERVICE_SECTION.COMPUTERIZED_AXIAL_TOMOGRAPHY,
        ),
      ],
      IMAGING,
    ],
    [
      "a radiology note",
      "MRI Knee",
      [codeFrom(CODE_SYSTEM.LOINC, DIAGNOSTIC_REPORT_NOTE_CATEGORY.RADIOLOGY)],
      IMAGING,
    ],
    [
      "a cardiology note",
      "Electrocardiogram",
      [codeFrom(CODE_SYSTEM.LOINC, DIAGNOSTIC_REPORT_NOTE_CATEGORY.CARDIOLOGY)],
      OTHER_REPORTS,
    ],
    ["a report with no category", "Sleep study", undefined, OTHER_REPORTS],
  ])("lists %s under its own tab only", async (_, title, category, tabKey) => {
    const user = userEvent.setup();
    const medplum = await createMedplumWithoutSampleReport();
    await createDiagnosticReport(medplum, title, "2026-10-18", [], {
      category,
    });

    renderTestResults(medplum);
    await screen.findByTestId(`${LABORATORY_RESULTS}-content`);

    for (const listedTabKey of [LABORATORY_RESULTS, IMAGING, OTHER_REPORTS]) {
      const panel = await openTab(user, listedTabKey);
      const isListedHere = listedTabKey === tabKey;
      await within(panel).findByTestId(
        `${listedTabKey}-${isListedHere ? "list" : "empty"}`,
      );
      expect(
        within(panel)
          .queryAllByTestId(`${listedTabKey}-record-title`)
          .map((reportTitle) => reportTitle.textContent),
      ).toEqual(isListedHere ? [title] : []);
    }
  });

  it("lists a report filed as both a lab report and imaging under both tabs, and not under other reports", async () => {
    const user = userEvent.setup();
    const medplum = await createMedplumWithoutSampleReport();
    await createDiagnosticReport(
      medplum,
      "CT-guided biopsy",
      "2026-10-18",
      [],
      {
        category: [
          codeFrom(
            CODE_SYSTEM.DIAGNOSTIC_SERVICE_SECTION,
            LABORATORY_SERVICE_SECTION.PATHOLOGY,
          ),
          radiology,
        ],
      },
    );

    renderTestResults(medplum);

    for (const tabKey of [LABORATORY_RESULTS, IMAGING]) {
      const panel = await openTab(user, tabKey);
      await within(panel).findByTestId(`${tabKey}-list`);
      expect(listReportTitles(panel, tabKey)).toEqual(["CT-guided biopsy"]);
    }
    expect(
      await within(await openTab(user, OTHER_REPORTS)).findByTestId(
        `${OTHER_REPORTS}-empty`,
      ),
    ).toBeInTheDocument();
  });

  it("leaves out reports and results entered in error", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    const vitaminD = await createReportResult(medplum, "Vitamin D");
    const mistakenResult = await createReportResult(
      medplum,
      "Calcium, entered by mistake",
      { status: OBSERVATION_STATUS.ENTERED_IN_ERROR },
    );
    await createDiagnosticReport(medplum, "Vitamin D", "2026-10-18", [
      vitaminD,
      mistakenResult,
    ]);
    await createDiagnosticReport(
      medplum,
      "Hemoglobin, entered by mistake",
      "2026-10-19",
      [],
      { status: DIAGNOSTIC_REPORT_STATUS.ENTERED_IN_ERROR },
    );

    renderTestResults(medplum);

    const list = await screen.findByTestId(`${LABORATORY_RESULTS}-list`);
    expect(listReportTitles(list, LABORATORY_RESULTS)).toEqual(["Vitamin D"]);
    expect(
      listResultCells(list, LABORATORY_RESULTS).map(([test]) => test),
    ).toEqual(["Vitamin D"]);
  });

  it("shows every kind of value: a coded one, each part of a multi-part one on its own line, why one is missing, and several reference ranges one per line", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    const results = [
      await createReportResult(medplum, "Strep A antigen", {
        valueCodeableConcept: { text: "Negative" },
      }),
      await createReportResult(medplum, "Blood pressure", {
        component: [
          {
            code: { text: "Systolic" },
            valueQuantity: { value: 118, unit: "mmHg" },
          },
          {
            code: { text: "Diastolic" },
            valueQuantity: { value: 76, unit: "mmHg" },
          },
        ],
      }),
      await createReportResult(medplum, "Potassium", {
        dataAbsentReason: { text: "Sample hemolyzed" },
      }),
      await createReportResult(medplum, "Ferritin", {
        valueQuantity: { value: 40, unit: "ng/mL" },
        referenceRange: [
          { text: "Women: 12 to 150 ng/mL" },
          { low: { value: 12, unit: "ng/mL" } },
        ],
      }),
      await createReportResult(medplum, "Note"),
    ];
    await createDiagnosticReport(medplum, "Visit tests", "2026-10-18", results);

    renderTestResults(medplum);

    const list = await screen.findByTestId(`${LABORATORY_RESULTS}-list`);
    expect(listResultCells(list, LABORATORY_RESULTS)).toEqual([
      ["Strep A antigen", "Negative", "", ""],
      ["Blood pressure", "", "", ""],
      ["Systolic", "118 mmHg", "", ""],
      ["Diastolic", "76 mmHg", "", ""],
      ["Potassium", "Sample hemolyzed", "", ""],
      ["Ferritin", "40 ng/mL", "Women: 12 to 150 ng/mL>= 12 ng/mL", ""],
      ["Note", "No value", "", ""],
    ]);
    const [, , rangeCell] = within(
      within(list).getAllByTestId(`${LABORATORY_RESULTS}-record-result`)[5],
    ).getAllByTestId(`${LABORATORY_RESULTS}-record-result-cell`);
    expect(
      Array.from(rangeCell.children).map((range) => range.textContent),
    ).toEqual(["Women: 12 to 150 ng/mL", ">= 12 ng/mL"]);
  });

  it("lists a panel's own results under it, indented, each with its status unless it is final", async () => {
    const medplum = await createMedplumWithoutSampleReport();
    const hemoglobin = await createReportResult(medplum, "Hemoglobin", {
      valueQuantity: { value: 14.2, unit: "g/dL" },
    });
    const whiteCells = await createReportResult(medplum, "White blood cells", {
      status: OBSERVATION_STATUS.PRELIMINARY,
      valueQuantity: { value: 6.1, unit: "10*3/uL" },
    });
    const bloodCount = await createReportResult(medplum, "Blood count", {
      hasMember: [createReference(hemoglobin), createReference(whiteCells)],
    });
    await createDiagnosticReport(
      medplum,
      "Complete blood count",
      "2026-10-18",
      [bloodCount],
    );

    renderTestResults(medplum);

    const list = await screen.findByTestId(`${LABORATORY_RESULTS}-list`);
    expect(listResultCells(list, LABORATORY_RESULTS)).toEqual([
      ["Blood count", "", "", ""],
      ["Hemoglobin", "14.2 g/dL", "", ""],
      ["White blood cells", "6.1 10*3/uL" + "Preliminary", "", ""],
    ]);
    expect(
      within(list)
        .getAllByTestId(`${LABORATORY_RESULTS}-record-result-status`)
        .map((status) => status.textContent),
    ).toEqual(["Preliminary"]);
    const [panelName, memberName] = within(list)
      .getAllByTestId(`${LABORATORY_RESULTS}-record-result`)
      .slice(0, 2)
      .map(
        (row) =>
          within(row).getAllByTestId(
            `${LABORATORY_RESULTS}-record-result-cell`,
          )[0].firstElementChild,
      );
    expect(panelName).not.toHaveStyle({ paddingLeft: "16px" });
    expect(memberName).toHaveStyle({ paddingLeft: "16px" });
  });

  it("shows results kept inside the report and results it points to by version", async () => {
    const medplum = await createMedplumWithoutSampleReport();
    const glucose = await createReportResult(medplum, "Glucose");
    const containedSodium = {
      resourceType: RESOURCE_TYPE.OBSERVATION,
      id: "sodium",
      status: OBSERVATION_STATUS.FINAL,
      code: { text: "Sodium" },
    } satisfies Observation;
    await createDiagnosticReport(
      medplum,
      "Basic metabolic panel",
      "2026-10-18",
      [],
      {
        contained: [containedSodium],
        result: [
          {
            reference: `${CONTAINED_REFERENCE_PREFIX}${containedSodium.id}`,
          },
          {
            reference: `${getReferenceString(glucose)}/${REFERENCE_HISTORY_SEGMENT}/1`,
          },
        ],
      },
    );

    renderTestResults(medplum);

    const list = await screen.findByTestId(`${LABORATORY_RESULTS}-list`);
    expect(
      listResultCells(list, LABORATORY_RESULTS).map(([test]) => test),
    ).toEqual(["Sodium", "Glucose"]);
  });

  it("shows only the results Medplum sends with the report", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    const vitaminD = await createReportResult(medplum, "Vitamin D");
    await createDiagnosticReport(medplum, "Vitamin D", "2026-10-18", [
      vitaminD,
      {
        resourceType: RESOURCE_TYPE.OBSERVATION,
        id: "not-shared",
        status: OBSERVATION_STATUS.FINAL,
        code: { text: "Calcium" },
      },
    ]);

    renderTestResults(medplum);

    const list = await screen.findByTestId(`${LABORATORY_RESULTS}-list`);
    expect(
      listResultCells(list, LABORATORY_RESULTS).map(([test]) => test),
    ).toEqual(["Vitamin D"]);
  });

  it("shows an imaging report's date as when it was performed, its conclusion, and no results table or reference range note when it has no results", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    await createDiagnosticReport(
      medplum,
      "XR Chest 2 Views",
      "2026-10-17",
      [],
      {
        category: [radiology],
        conclusion: "No acute cardiopulmonary abnormality.",
        performer: [{ display: "Harbor Synthetic Imaging" }],
      },
    );

    renderTestResults(medplum);
    const panel = await openTab(user, IMAGING);

    const report = (
      await within(panel).findAllByTestId(`${IMAGING}-record`)
    )[0];
    expect(
      within(report).getByTestId(`${IMAGING}-record-byline`),
    ).toHaveTextContent(
      "Performed October 17, 2026 · Harbor Synthetic Imaging",
    );
    expect(
      within(report).getByTestId(`${IMAGING}-record-conclusion`),
    ).toHaveTextContent("No acute cardiopulmonary abnormality.");
    expect(
      within(report).queryByTestId(`${IMAGING}-record-results`),
    ).not.toBeInTheDocument();
    expect(
      within(report).queryByTestId(`${IMAGING}-record-notice`),
    ).not.toBeInTheDocument();
  });

  it("says when a report comes as a document, which the portal does not show", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    await createDiagnosticReport(
      medplum,
      "Pathology report",
      "2026-10-18",
      [],
      {
        presentedForm: [
          {
            contentType: "application/pdf",
            url: "https://example.org/pathology-report.pdf",
          },
        ],
      },
    );
    await createDiagnosticReport(medplum, "Vitamin D", "2026-10-17", [
      await createReportResult(medplum, "Vitamin D"),
    ]);

    renderTestResults(medplum);

    const [documentOnly, withResults] = await screen.findAllByTestId(
      `${LABORATORY_RESULTS}-record`,
    );
    expect(
      within(documentOnly).getByTestId(`${LABORATORY_RESULTS}-record-document`),
    ).toHaveTextContent(
      "The full report is a document, which is not shown here.",
    );
    expect(
      within(documentOnly).queryByTestId(
        `${LABORATORY_RESULTS}-record-results`,
      ),
    ).not.toBeInTheDocument();
    expect(
      within(withResults).queryByTestId(
        `${LABORATORY_RESULTS}-record-document`,
      ),
    ).not.toBeInTheDocument();
  });

  it("names a report's status in plain words, and leaves out the date or the lab when the report has none", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    await createDiagnosticReport(medplum, "Lipid panel", "2026-10-18", [], {
      status: DIAGNOSTIC_REPORT_STATUS.PRELIMINARY,
      performer: undefined,
    });
    await createDiagnosticReport(medplum, "Old lipid panel", undefined, []);

    renderTestResults(medplum);

    const [dated, undated] = await screen.findAllByTestId(
      `${LABORATORY_RESULTS}-record`,
    );
    expect(
      within(dated).getByTestId(`${LABORATORY_RESULTS}-record-byline`),
    ).toHaveTextContent(/^Collected October 18, 2026$/);
    expect(
      within(dated).getByTestId(`${LABORATORY_RESULTS}-record-status`),
    ).toHaveTextContent("Preliminary");
    expect(
      within(undated).getByTestId(`${LABORATORY_RESULTS}-record-byline`),
    ).toHaveTextContent(new RegExp(`^${laboratory.display}$`));
  });

  it("says so when a tab has nothing in it", async () => {
    const user = userEvent.setup();
    renderTestResults(await createMedplumWithoutSampleReport());

    expect(
      await screen.findByTestId(`${LABORATORY_RESULTS}-empty`),
    ).toHaveTextContent(`No lab results available${MISSING_REPORT_NOTICE}`);
    expect(
      await within(await openTab(user, IMAGING)).findByTestId(
        `${IMAGING}-empty`,
      ),
    ).toHaveTextContent(`No imaging available${MISSING_REPORT_NOTICE}`);
    expect(
      await within(await openTab(user, OTHER_REPORTS)).findByTestId(
        `${OTHER_REPORTS}-empty`,
      ),
    ).toHaveTextContent(`No other reports available${MISSING_REPORT_NOTICE}`);
  });

  it("shows the newest page of reports with their results first, and the older ones when the patient asks for more", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    const reportCount = constant.SEARCH_PAGE_SIZE + 1;
    for (let index = 0; index < reportCount; index += 1) {
      const result = await createReportResult(medplum, `Result ${index + 1}`);
      await createDiagnosticReport(
        medplum,
        `Report ${index + 1}`,
        new Date(Date.UTC(2020, 0, 1 + index)).toISOString().slice(0, 10),
        [result],
      );
    }

    renderTestResults(medplum);

    const list = await screen.findByTestId(`${LABORATORY_RESULTS}-list`);
    expect(
      within(list).getAllByTestId(`${LABORATORY_RESULTS}-record`),
    ).toHaveLength(constant.SEARCH_PAGE_SIZE);
    expect(
      within(list).getAllByTestId(`${LABORATORY_RESULTS}-record-result`),
    ).toHaveLength(constant.SEARCH_PAGE_SIZE);
    await user.click(screen.getByTestId(`${LABORATORY_RESULTS}-more`));

    await waitFor(() =>
      expect(
        within(list).getAllByTestId(`${LABORATORY_RESULTS}-record`),
      ).toHaveLength(reportCount),
    );
    const records = within(list).getAllByTestId(`${LABORATORY_RESULTS}-record`);
    const [newest] = records;
    const oldest = records[records.length - 1];
    expect(
      listResultCells(newest, LABORATORY_RESULTS).map(([test]) => test),
    ).toEqual([`Result ${reportCount}`]);
    expect(
      within(oldest).getByTestId(`${LABORATORY_RESULTS}-record-title`),
    ).toHaveTextContent("Report 1");
    expect(
      listResultCells(oldest, LABORATORY_RESULTS).map(([test]) => test),
    ).toEqual(["Result 1"]);
    expect(
      screen.queryByTestId(`${LABORATORY_RESULTS}-more`),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId(`${LABORATORY_RESULTS}-status`).textContent).toBe(
      `${reportCount} records shown`,
    );
  });

  it("shows a full page of reports with ten results each", async () => {
    const medplum = await createMedplumWithoutSampleReport();
    const resultsPerReport = 10;
    for (let index = 0; index < constant.SEARCH_PAGE_SIZE; index += 1) {
      const results = await Promise.all(
        Array.from({ length: resultsPerReport }, (_, resultIndex) =>
          createReportResult(medplum, `Result ${index + 1}.${resultIndex + 1}`),
        ),
      );
      await createDiagnosticReport(
        medplum,
        `Report ${index + 1}`,
        new Date(Date.UTC(2020, 0, 1 + index)).toISOString().slice(0, 10),
        results,
      );
    }

    renderTestResults(medplum);

    const list = await screen.findByTestId(`${LABORATORY_RESULTS}-list`);
    expect(
      within(list).getAllByTestId(`${LABORATORY_RESULTS}-record`),
    ).toHaveLength(constant.SEARCH_PAGE_SIZE);
    expect(
      within(list).getAllByTestId(`${LABORATORY_RESULTS}-record-result`),
    ).toHaveLength(constant.SEARCH_PAGE_SIZE * resultsPerReport);
    expect(screen.queryByTestId("test-results-error")).not.toBeInTheDocument();
  });

  it("reads a page's results without Medplum's cache, by identifier, in searches of at most a page each, and leaves out results entered in error", async () => {
    const medplum = await createMedplumWithoutSampleReport();
    const results = [];
    for (let index = 0; index <= constant.SEARCH_PAGE_SIZE; index += 1) {
      results.push(await createReportResult(medplum, `Result ${index + 1}`));
    }
    results.push(
      await createReportResult(medplum, "Calcium, entered by mistake", {
        status: OBSERVATION_STATUS.ENTERED_IN_ERROR,
      }),
    );
    await createDiagnosticReport(medplum, "Long panel", "2026-10-18", results);
    const searchResources = vi.spyOn(medplum, "searchResources");

    renderTestResults(medplum);

    const list = await screen.findByTestId(`${LABORATORY_RESULTS}-list`);
    expect(
      within(list).getAllByTestId(`${LABORATORY_RESULTS}-record-result`),
    ).toHaveLength(constant.SEARCH_PAGE_SIZE + 1);
    const resultSearches = searchResources.mock.calls.filter(
      ([resourceType]) => resourceType === RESOURCE_TYPE.OBSERVATION,
    );
    expect(resultSearches).toHaveLength(2);
    const searchedIdentifiers = resultSearches.flatMap(
      ([resourceType, query, options]) => {
        expect(options).toEqual(expect.objectContaining({ cache: "reload" }));
        const searchRequest = readSearchRequest(medplum, resourceType, query);
        expect(
          findFilterValues(searchRequest, SEARCH_PARAMETER.STATUS),
        ).toEqual([
          {
            operator: Operator.NOT,
            value: OBSERVATION_STATUS.ENTERED_IN_ERROR,
          },
        ]);
        const [identifiers] = findFilterValues(
          searchRequest,
          SEARCH_PARAMETER.ID,
        );
        const identifierList = identifiers.value.split(SEARCH_VALUE_SEPARATOR);
        expect(identifierList.length).toBeLessThanOrEqual(
          constant.SEARCH_PAGE_SIZE,
        );
        expect(searchRequest.count).toBe(identifierList.length);
        return identifierList;
      },
    );
    expect(searchedIdentifiers.toSorted()).toEqual(
      results.map(({ id }) => id).toSorted(),
    );
  });

  const isSearchFor =
    (resourceType: string) => (searchRequest: SearchRequest) =>
      searchRequest.resourceType === resourceType;

  const isUndatedReportSearch = (searchRequest: SearchRequest) =>
    isSearchFor(RESOURCE_TYPE.DIAGNOSTIC_REPORT)(searchRequest) &&
    findFilterValues(searchRequest, SEARCH_PARAMETER.DATE).some(
      ({ operator, value }) =>
        operator === Operator.MISSING && value === String(true),
    );

  const isResultSearchFor =
    (identifier: string) => (searchRequest: SearchRequest) =>
      isSearchFor(RESOURCE_TYPE.OBSERVATION)(searchRequest) &&
      findFilterValues(searchRequest, SEARCH_PARAMETER.ID).some(({ value }) =>
        value.split(SEARCH_VALUE_SEPARATOR).includes(identifier),
      );

  it.each([
    [
      "the search for undated reports",
      async (medplum: MockClient) => {
        await createDiagnosticReport(medplum, "Vitamin D", "2026-10-18", []);
        return isUndatedReportSearch;
      },
    ],
    [
      "the search for a page's results",
      async (medplum: MockClient) => {
        const vitaminD = await createReportResult(medplum, "Vitamin D");
        await createDiagnosticReport(medplum, "Vitamin D", "2026-10-18", [
          vitaminD,
        ]);
        return isResultSearchFor(vitaminD.id);
      },
    ],
    [
      "a later search of a page's results",
      async (medplum: MockClient) => {
        const results = [];
        for (let index = 0; index <= constant.SEARCH_PAGE_SIZE; index += 1) {
          results.push(
            await createReportResult(medplum, `Result ${index + 1}`),
          );
        }
        await createDiagnosticReport(
          medplum,
          "Long panel",
          "2026-10-18",
          results,
        );
        return isResultSearchFor(results[constant.SEARCH_PAGE_SIZE].id);
      },
    ],
    [
      "the search for a panel's own results",
      async (medplum: MockClient) => {
        const hemoglobin = await createReportResult(medplum, "Hemoglobin");
        const bloodCount = await createReportResult(medplum, "Blood count", {
          hasMember: [createReference(hemoglobin)],
        });
        await createDiagnosticReport(
          medplum,
          "Complete blood count",
          "2026-10-18",
          [bloodCount],
        );
        return isResultSearchFor(hemoglobin.id);
      },
    ],
  ])(
    "shows an error and marks the tab when %s could not be read",
    async (_, createRecordsAndChooseFailingSearch) => {
      const medplum = await createMedplumWithoutSampleReport();
      const isFailingSearch =
        await createRecordsAndChooseFailingSearch(medplum);
      const searchResources = failSearches(medplum, isFailingSearch);

      renderTestResults(medplum);

      expect(await screen.findByTestId("test-results-error")).toHaveTextContent(
        constant.DEFAULT_ERROR_MESSAGE,
      );
      expect(
        screen.getByTestId(`${LABORATORY_RESULTS}-unavailable`),
      ).toHaveTextContent("Could not load");
      expect(
        parseSearchRequests(medplum, searchResources).filter(isFailingSearch),
      ).toHaveLength(1);
    },
  );

  it("keeps the reports already listed when the next page could not be read", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    for (let index = 0; index <= constant.SEARCH_PAGE_SIZE; index += 1) {
      await createDiagnosticReport(
        medplum,
        `Report ${index + 1}`,
        new Date(Date.UTC(2020, 0, 1 + index)).toISOString().slice(0, 10),
        [],
      );
    }
    let isRecordReachable = true;
    failSearches(medplum, () => !isRecordReachable);

    renderTestResults(medplum);
    const list = await screen.findByTestId(`${LABORATORY_RESULTS}-list`);
    isRecordReachable = false;
    await user.click(screen.getByTestId(`${LABORATORY_RESULTS}-more`));

    expect(await screen.findByTestId("test-results-error")).toHaveTextContent(
      constant.DEFAULT_ERROR_MESSAGE,
    );
    expect(
      within(list).getAllByTestId(`${LABORATORY_RESULTS}-record`),
    ).toHaveLength(constant.SEARCH_PAGE_SIZE);
  });

  it("shows an error and marks the tab that could not be read", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    failSearches(medplum, () => true);

    renderTestResults(medplum);

    expect(await screen.findByTestId("test-results-error")).toHaveTextContent(
      constant.DEFAULT_ERROR_MESSAGE,
    );
    expect(
      screen.getByTestId(`${LABORATORY_RESULTS}-unavailable`),
    ).toHaveTextContent("Could not load");
  });

  it("reads the reports again when the patient chooses to try again", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    await createDiagnosticReport(medplum, "Vitamin D", "2026-10-18", []);
    let isRecordReachable = false;
    failSearches(medplum, () => !isRecordReachable);

    renderTestResults(medplum);
    const retry = await screen.findByTestId("test-results-error-retry");
    isRecordReachable = true;
    await user.click(within(retry).getByRole("button"));

    const list = await screen.findByTestId(`${LABORATORY_RESULTS}-list`);
    expect(listReportTitles(list, LABORATORY_RESULTS)).toEqual(["Vitamin D"]);
    expect(screen.queryByTestId("test-results-error")).not.toBeInTheDocument();
  });

  it("reads imaging and other reports only once their tab is opened", async () => {
    const user = userEvent.setup();
    const medplum = await createMedplumWithoutSampleReport();
    const searchResources = vi.spyOn(medplum, "searchResources");

    const listSearchedCategories = () => [
      ...new Set(
        parseSearchRequests(medplum, searchResources).map((searchRequest) =>
          JSON.stringify(
            findFilterValues(searchRequest, SEARCH_PARAMETER.CATEGORY),
          ),
        ),
      ),
    ];

    renderTestResults(medplum);
    await screen.findByTestId(`${LABORATORY_RESULTS}-empty`);
    expect(listSearchedCategories()).toHaveLength(1);

    await within(await openTab(user, IMAGING)).findByTestId(`${IMAGING}-empty`);
    expect(listSearchedCategories()).toHaveLength(2);
    await within(await openTab(user, OTHER_REPORTS)).findByTestId(
      `${OTHER_REPORTS}-empty`,
    );
    await openTab(user, LABORATORY_RESULTS);
    expect(listSearchedCategories()).toHaveLength(3);
  });

  it("asks Medplum without its cache, for each tab's categories in one filter, none entered in error, the dated ones newest first and then the undated ones, with only search parameters that reports define", async () => {
    const user = userEvent.setup();
    const medplum = await createMedplumWithoutSampleReport();
    const searchResources = vi.spyOn(medplum, "searchResources");

    renderTestResults(medplum);
    await screen.findByTestId(`${LABORATORY_RESULTS}-empty`);
    await within(await openTab(user, IMAGING)).findByTestId(`${IMAGING}-empty`);
    await within(await openTab(user, OTHER_REPORTS)).findByTestId(
      `${OTHER_REPORTS}-empty`,
    );

    for (const [resourceType, , options] of searchResources.mock.calls) {
      expect(resourceType).toBe(RESOURCE_TYPE.DIAGNOSTIC_REPORT);
      expect(options).toEqual(expect.objectContaining({ cache: "reload" }));
    }
    const searchedFor = (categoryFilters: Filter[], hasDate: boolean) => ({
      filters: expect.arrayContaining<Filter>([
        ...categoryFilters,
        {
          code: SEARCH_PARAMETER.STATUS,
          operator: Operator.NOT,
          value: DIAGNOSTIC_REPORT_STATUS.ENTERED_IN_ERROR,
        },
        {
          code: SEARCH_PARAMETER.DATE,
          operator: Operator.MISSING,
          value: String(!hasDate),
        },
      ]),
      sortRules: hasDate
        ? [{ code: SEARCH_PARAMETER.DATE, descending: true }]
        : [{ code: SEARCH_PARAMETER.ID, descending: false }],
    });
    const laboratoryFilters = [
      {
        code: SEARCH_PARAMETER.CATEGORY,
        operator: Operator.EQUALS,
        value: DIAGNOSTIC_REPORT_CATEGORY.LABORATORY.join(
          SEARCH_VALUE_SEPARATOR,
        ),
      },
    ];
    const imagingFilters = [
      {
        code: SEARCH_PARAMETER.CATEGORY,
        operator: Operator.EQUALS,
        value: DIAGNOSTIC_REPORT_CATEGORY.IMAGING.join(SEARCH_VALUE_SEPARATOR),
      },
    ];
    const otherFilters = [
      {
        code: SEARCH_PARAMETER.CATEGORY,
        operator: Operator.NOT,
        value: [
          ...DIAGNOSTIC_REPORT_CATEGORY.IMAGING,
          ...DIAGNOSTIC_REPORT_CATEGORY.LABORATORY,
        ].join(SEARCH_VALUE_SEPARATOR),
      },
    ];
    const searchRequests = parseSearchRequests(medplum, searchResources);
    expect(searchRequests).toEqual([
      expect.objectContaining(searchedFor(laboratoryFilters, true)),
      expect.objectContaining(searchedFor(laboratoryFilters, false)),
      expect.objectContaining(searchedFor(imagingFilters, true)),
      expect.objectContaining(searchedFor(imagingFilters, false)),
      expect.objectContaining(searchedFor(otherFilters, true)),
      expect.objectContaining(searchedFor(otherFilters, false)),
    ]);
    for (const searchRequest of searchRequests) {
      expect(findFilterValues(searchRequest, SEARCH_PARAMETER.PATIENT)).toEqual(
        [{ operator: Operator.EQUALS, value: homer.reference }],
      );
      for (const { code } of [
        ...(searchRequest.filters ?? []),
        ...(searchRequest.sortRules ?? []),
      ]) {
        expect(
          getSearchParameter(RESOURCE_TYPE.DIAGNOSTIC_REPORT, code),
          code,
        ).toBeDefined();
      }
    }
  });

  it("moves between the tabs with the arrow keys", async () => {
    const user = userEvent.setup();
    renderTestResults(new MockClient({ profile: HomerSimpson }));

    await screen.findByTestId(`${LABORATORY_RESULTS}-empty`);
    await user.click(screen.getByTestId(`${LABORATORY_RESULTS}-tab`));
    // Base Web reads the deprecated keyCode, which user-event leaves at 0; browsers set it.
    fireEvent.keyDown(screen.getByTestId(`${LABORATORY_RESULTS}-tab`), {
      key: "ArrowRight",
      keyCode: 39,
    });

    expect(screen.getByTestId(`${IMAGING}-tab`)).toHaveFocus();
    expect(screen.getByTestId(`${IMAGING}-tab`)).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("tells a screen reader how many reports arrived, without reading the reports or their results out", async () => {
    const medplum = await createMedplumWithoutSampleReport();
    const vitaminD = await createReportResult(medplum, "Vitamin D", {
      valueQuantity: { value: 24, unit: "ng/mL" },
    });
    await createDiagnosticReport(medplum, "Vitamin D", "2026-10-18", [
      vitaminD,
    ]);

    renderTestResults(medplum);

    const status = screen.getByTestId(`${LABORATORY_RESULTS}-status`);
    expect(status).toHaveAttribute("role", "status");
    expect(status).toHaveTextContent("Loading…");
    const list = await screen.findByTestId(`${LABORATORY_RESULTS}-list`);
    expect(screen.getByTestId(`${LABORATORY_RESULTS}-status`)).toBe(status);
    expect(status.textContent).toBe("1 record shown");
    expect(status).not.toContainElement(list);
    expect(
      await within(list).findByTestId(`${LABORATORY_RESULTS}-record-results`),
    ).toBeVisible();
  });
});
