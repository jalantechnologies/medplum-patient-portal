import {
  createReference,
  getSearchParameter,
  Operator,
  parseSearchRequest,
} from "@medplum/core";
import type { Condition, Observation, Patient } from "@medplum/fhirtypes";
import { HomerSimpson, MockClient } from "@medplum/mock";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createMemoryRouter,
  RouterProvider,
  type InitialEntry,
} from "react-router";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import constant from "../../constants";
import {
  ALLERGY_INTOLERANCE_CLINICAL_STATUS,
  ALLERGY_INTOLERANCE_VERIFICATION_STATUS,
  CODE_SYSTEM,
  CONDITION_CLINICAL_STATUS,
  CONDITION_VERIFICATION_STATUS,
  OBSERVATION_CATEGORY,
  OBSERVATION_STATUS,
  RESOURCE_TYPE,
  SEARCH_PARAMETER,
} from "../../constants/fhir";
import routes from "../../constants/routes";
import {
  AllergyIntoleranceProvider,
  ConditionProvider,
  ObservationProvider,
} from "../../providers";
import { codeFrom, createAllergyIntolerance, doctor } from "../../test-medplum";
import { TestProviders } from "../../test-providers";
import HealthRecords from "./health-records.page";

const homer = createReference(HomerSimpson);
const renderHealthRecords = (
  medplum: MockClient,
  path: InitialEntry = routes.HEALTH_RECORDS,
) => {
  const router = createMemoryRouter(
    [
      {
        path: routes.HEALTH_RECORDS,
        element: (
          <ConditionProvider>
            <AllergyIntoleranceProvider>
              <ObservationProvider>
                <HealthRecords />
              </ObservationProvider>
            </AllergyIntoleranceProvider>
          </ConditionProvider>
        ),
      },
    ],
    { initialEntries: [path] },
  );
  const result = render(
    <TestProviders medplum={medplum}>
      <RouterProvider router={router} />
    </TestProviders>,
  );
  return { ...result, router };
};

const createCondition = (
  medplum: MockClient,
  name: string,
  recordedDate: string | undefined,
  overrides: Partial<Condition> = {},
): Promise<Condition> =>
  medplum.createResource<Condition>({
    resourceType: RESOURCE_TYPE.CONDITION,
    subject: homer,
    code: { text: name },
    recordedDate,
    recorder: doctor,
    clinicalStatus: codeFrom(
      CODE_SYSTEM.CONDITION_CLINICAL,
      CONDITION_CLINICAL_STATUS.ACTIVE,
    ),
    ...overrides,
  });

const createObservation = (
  medplum: MockClient,
  category: string,
  name: string,
  overrides: Partial<Observation>,
): Promise<Observation> =>
  medplum.createResource<Observation>({
    resourceType: RESOURCE_TYPE.OBSERVATION,
    status: OBSERVATION_STATUS.FINAL,
    subject: homer,
    category: [codeFrom(CODE_SYSTEM.OBSERVATION_CATEGORY, category)],
    code: { text: name },
    performer: [doctor],
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
    ...overrides,
  });

const showDatesInChicago = () => {
  vi.stubEnv("TZ", "America/Chicago");
  onTestFinished(() => {
    vi.unstubAllEnvs();
  });
};

const failSearches = (
  medplum: MockClient,
  shouldFail: (resourceType: string) => boolean,
) => {
  const searchResources = medplum.searchResources.bind(medplum);
  return vi
    .spyOn(medplum, "searchResources")
    .mockImplementation(((resourceType, query, options) =>
      shouldFail(resourceType)
        ? Promise.reject(new TypeError("Failed to fetch"))
        : searchResources(
            resourceType,
            query,
            options,
          )) as typeof medplum.searchResources);
};

const openTab = async (
  user: ReturnType<typeof userEvent.setup>,
  tabKey: string,
) => {
  await user.click(screen.getByTestId(`${tabKey}-tab`));
  return screen.getByTestId(`${tabKey}-panel`);
};

const listRecordTitles = (panel: HTMLElement, tabKey: string) =>
  within(panel)
    .getAllByTestId(`${tabKey}-record`)
    .map((row) => within(row).getAllByText(/./)[0].textContent);

const listRecordTexts = (panel: HTMLElement, tabKey: string) =>
  within(panel)
    .getAllByTestId(`${tabKey}-record`)
    .map((row) => row.textContent);

describe("Health records", () => {
  it("shows whose record it is, the title, and a tab for each kind of record with Conditions open", async () => {
    renderHealthRecords(new MockClient({ profile: HomerSimpson }));

    expect(screen.getByTestId("health-records-record-owner")).toHaveTextContent(
      "Your record · Homer Simpson",
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Health records" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Conditions",
      "Allergies",
      "Measurements",
    ]);
    expect(screen.getByTestId("conditions-tab")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(await screen.findByTestId("conditions-empty")).toBeInTheDocument();
  });

  it("shows loading in a tab until the record answers", async () => {
    renderHealthRecords(new MockClient({ profile: HomerSimpson }));

    expect(screen.getByTestId("conditions-loading")).toHaveTextContent(
      "Loading…",
    );
    expect(await screen.findByTestId("conditions-empty")).toBeInTheDocument();
  });

  it("lists the patient's conditions newest first, with when, by whom and their status", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    await createCondition(medplum, "Seasonal rhinitis", "2024-03-12", {
      clinicalStatus: codeFrom(
        CODE_SYSTEM.CONDITION_CLINICAL,
        CONDITION_CLINICAL_STATUS.RESOLVED,
      ),
    });
    await createCondition(medplum, "Eczema", "2026-10-20");

    renderHealthRecords(medplum);

    const list = await screen.findByTestId("conditions-list");
    const rows = within(list).getAllByTestId("conditions-record");
    expect(rows.map((row) => row.textContent)).toEqual([
      "EczemaOctober 20, 2026Dr. Mira SyntheticActiveView record",
      "Seasonal rhinitisMarch 12, 2024Dr. Mira SyntheticResolvedView record",
    ]);
    expect(list.tagName).toBe("UL");
    expect(rows[0].tagName).toBe("LI");
  });

  it("lists conditions with no recorded date after the dated ones", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    await createCondition(medplum, "Seasonal rhinitis", "2024-03-12");
    await createCondition(medplum, "Childhood asthma", undefined);
    await createCondition(medplum, "Eczema", "2026-10-20");

    renderHealthRecords(medplum);

    const list = await screen.findByTestId("conditions-list");
    expect(listRecordTitles(list, "conditions")).toEqual([
      "Eczema",
      "Seasonal rhinitis",
      "Childhood asthma",
    ]);
  });

  it("shows only the signed-in patient's conditions", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    const otherPatient = await medplum.createResource<Patient>({
      resourceType: RESOURCE_TYPE.PATIENT,
      name: [{ given: ["Harper"], family: "Synthetic" }],
    });
    await createCondition(medplum, "Another patient's asthma", "2026-10-21", {
      subject: createReference(otherPatient),
    });
    await createCondition(medplum, "Eczema", "2026-10-20");

    renderHealthRecords(medplum);

    const list = await screen.findByTestId("conditions-list");
    expect(listRecordTitles(list, "conditions")).toEqual(["Eczema"]);
  });

  it("shows each date on the patient's own calendar day, and a partial date only as precisely as it is known", async () => {
    showDatesInChicago();
    const medplum = new MockClient({ profile: HomerSimpson });
    await createCondition(
      medplum,
      "Recorded at an evening visit",
      "2026-10-20T22:30:00-05:00",
    );
    await createCondition(medplum, "Recorded on a day", "2025-06-01");
    await createCondition(medplum, "Recorded in a month", "2024-03");
    await createCondition(medplum, "Recorded in a year", "2023");

    renderHealthRecords(medplum);

    const list = await screen.findByTestId("conditions-list");
    expect(listRecordTexts(list, "conditions")).toEqual([
      "Recorded at an evening visitOctober 20, 2026Dr. Mira SyntheticActiveView record",
      "Recorded on a dayJune 1, 2025Dr. Mira SyntheticActiveView record",
      "Recorded in a monthMarch 2024Dr. Mira SyntheticActiveView record",
      "Recorded in a year2023Dr. Mira SyntheticActiveView record",
    ]);
  });

  it("shows whether each allergy is still current, and how sure the clinic is of it in the record", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    await createAllergyIntolerance(
      medplum,
      { text: "Penicillin" },
      "2024-03-12",
    );
    await createAllergyIntolerance(medplum, { text: "Latex" }, "2022-05-02", {
      clinicalStatus: codeFrom(
        CODE_SYSTEM.ALLERGY_INTOLERANCE_CLINICAL,
        ALLERGY_INTOLERANCE_CLINICAL_STATUS.RESOLVED,
      ),
      verificationStatus: codeFrom(
        CODE_SYSTEM.ALLERGY_INTOLERANCE_VERIFICATION,
        ALLERGY_INTOLERANCE_VERIFICATION_STATUS.CONFIRMED,
      ),
    });

    renderHealthRecords(medplum);
    await screen.findByTestId("conditions-empty");
    const panel = await openTab(user, "allergies");

    expect(screen.getByTestId("allergies-tab")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      await within(panel).findAllByTestId("allergies-record"),
    ).toHaveLength(2);
    expect(listRecordTexts(panel, "allergies")).toEqual([
      "PenicillinMarch 12, 2024Dr. Mira SyntheticActiveView record",
      "LatexMay 2, 2022Dr. Mira SyntheticResolvedView record",
    ]);

    await user.click(
      within(panel).getByRole("button", { name: "View record: Latex" }),
    );
    expect(
      within(await screen.findByTestId("health-record-dialog")).getByTestId(
        "health-record-details",
      ),
    ).toHaveTextContent(
      "PatientHomer SimpsonDateMay 2, 2022VerificationConfirmedAuthorDr. Mira Synthetic",
    );
  });

  it("lists vital signs as measurements and leaves out laboratory results", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    await createObservation(
      medplum,
      OBSERVATION_CATEGORY.LABORATORY,
      "Vitamin D",
      {
        effectiveDateTime: "2026-10-18",
      },
    );
    await createObservation(
      medplum,
      OBSERVATION_CATEGORY.VITAL_SIGNS,
      "Blood pressure",
      { effectiveDateTime: "2026-10-20" },
    );

    renderHealthRecords(medplum);
    await screen.findByTestId("conditions-empty");
    const panel = await openTab(user, "measurements");

    expect(
      listRecordTitles(
        await within(panel).findByTestId("measurements-list"),
        "measurements",
      ),
    ).toEqual(["Blood pressure"]);
    expect(within(panel).getByTestId("measurements-record")).toHaveTextContent(
      "Final",
    );
  });

  it("dates a measurement taken over a period by its start, and one taken at an instant by that instant", async () => {
    showDatesInChicago();
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    await createObservation(
      medplum,
      OBSERVATION_CATEGORY.VITAL_SIGNS,
      "Blood pressure over a day",
      {
        effectivePeriod: {
          start: "2026-10-19T08:00:00-05:00",
          end: "2026-10-20T08:00:00-05:00",
        },
      },
    );
    await createObservation(
      medplum,
      OBSERVATION_CATEGORY.VITAL_SIGNS,
      "Heart rate",
      { effectiveInstant: "2026-10-18T15:00:00Z" },
    );

    renderHealthRecords(medplum);
    await screen.findByTestId("conditions-empty");
    const panel = await openTab(user, "measurements");
    await within(panel).findByTestId("measurements-list");

    expect(listRecordTexts(panel, "measurements").toSorted()).toEqual([
      "Blood pressure over a dayOctober 19, 2026Dr. Mira SyntheticFinalView record",
      "Heart rateOctober 18, 2026Dr. Mira SyntheticFinalView record",
    ]);
  });

  it("leaves out records entered in error", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    await createCondition(medplum, "Eczema", "2026-10-20");
    await createCondition(
      medplum,
      "Diabetes, entered by mistake",
      "2026-10-21",
      {
        clinicalStatus: undefined,
        verificationStatus: codeFrom(
          CODE_SYSTEM.CONDITION_VERIFICATION,
          CONDITION_VERIFICATION_STATUS.ENTERED_IN_ERROR,
        ),
      },
    );
    await createAllergyIntolerance(
      medplum,
      { text: "Penicillin" },
      "2024-03-12",
    );
    await createAllergyIntolerance(
      medplum,
      { text: "Peanuts, entered by mistake" },
      "2024-03-13",
      {
        clinicalStatus: undefined,
        verificationStatus: codeFrom(
          CODE_SYSTEM.ALLERGY_INTOLERANCE_VERIFICATION,
          ALLERGY_INTOLERANCE_VERIFICATION_STATUS.ENTERED_IN_ERROR,
        ),
      },
    );
    await createObservation(
      medplum,
      OBSERVATION_CATEGORY.VITAL_SIGNS,
      "Blood pressure",
      { effectiveDateTime: "2026-10-20" },
    );
    await createObservation(
      medplum,
      OBSERVATION_CATEGORY.VITAL_SIGNS,
      "Blood pressure, entered by mistake",
      {
        effectiveDateTime: "2026-10-21",
        status: OBSERVATION_STATUS.ENTERED_IN_ERROR,
      },
    );

    renderHealthRecords(medplum);

    expect(
      listRecordTitles(
        await screen.findByTestId("conditions-list"),
        "conditions",
      ),
    ).toEqual(["Eczema"]);
    const allergies = await openTab(user, "allergies");
    expect(
      listRecordTitles(
        await within(allergies).findByTestId("allergies-list"),
        "allergies",
      ),
    ).toEqual(["Penicillin"]);
    const measurements = await openTab(user, "measurements");
    expect(
      listRecordTitles(
        await within(measurements).findByTestId("measurements-list"),
        "measurements",
      ),
    ).toEqual(["Blood pressure"]);
  });

  it("says so when a kind of record has nothing in it", async () => {
    const user = userEvent.setup();
    renderHealthRecords(new MockClient({ profile: HomerSimpson }));

    expect(await screen.findByTestId("conditions-empty")).toHaveTextContent(
      "No conditions availableNo condition information has been shared.",
    );
    expect(
      await within(await openTab(user, "allergies")).findByTestId(
        "allergies-empty",
      ),
    ).toHaveTextContent(
      "No allergies availableNo allergy information has been shared.",
    );
    expect(
      await within(await openTab(user, "measurements")).findByTestId(
        "measurements-empty",
      ),
    ).toHaveTextContent(
      "No measurements availableNo measurement information has been shared.",
    );
  });

  it("shows the newest page of records first, and the older ones when the patient asks for more", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    const conditionCount = constant.SEARCH_PAGE_SIZE + 1;
    for (let index = 0; index < conditionCount; index += 1) {
      await createCondition(
        medplum,
        `Condition ${index + 1}`,
        new Date(Date.UTC(2020, 0, 1 + index)).toISOString().slice(0, 10),
      );
    }

    renderHealthRecords(medplum);

    const list = await screen.findByTestId("conditions-list");
    expect(within(list).getAllByTestId("conditions-record")).toHaveLength(
      constant.SEARCH_PAGE_SIZE,
    );
    await user.click(screen.getByTestId("conditions-more"));

    await waitFor(() =>
      expect(within(list).getAllByTestId("conditions-record")).toHaveLength(
        conditionCount,
      ),
    );
    expect(listRecordTitles(list, "conditions").at(-1)).toBe("Condition 1");
    expect(screen.queryByTestId("conditions-more")).not.toBeInTheDocument();
  });

  it("lists every dated record before the undated ones, even when the undated ones fill a page", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    for (let index = 0; index < constant.SEARCH_PAGE_SIZE; index += 1) {
      await createCondition(
        medplum,
        `Undated condition ${index + 1}`,
        undefined,
      );
    }
    await createCondition(medplum, "Eczema", "2026-10-20");

    renderHealthRecords(medplum);

    const list = await screen.findByTestId("conditions-list");
    expect(listRecordTitles(list, "conditions")[0]).toBe("Eczema");
    await user.click(screen.getByTestId("conditions-more"));
    await waitFor(() =>
      expect(within(list).getAllByTestId("conditions-record")).toHaveLength(
        constant.SEARCH_PAGE_SIZE + 1,
      ),
    );
    expect(listRecordTitles(list, "conditions")[0]).toBe("Eczema");
    expect(screen.queryByTestId("conditions-more")).not.toBeInTheDocument();
  });

  it("reads the dated records newest first, then the undated ones in a search of their own", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    const searchResources = vi.spyOn(medplum, "searchResources");

    renderHealthRecords(medplum);
    await screen.findByTestId("conditions-empty");

    expect(
      searchResources.mock.calls.map(([resourceType, query]) => {
        const { filters, sortRules } = parseSearchRequest(
          `${resourceType}${String(query)}`,
        );
        return {
          dateFilter: filters?.find(
            ({ code }) => code === SEARCH_PARAMETER.RECORDED_DATE,
          ),
          sortRules,
        };
      }),
    ).toEqual([
      {
        dateFilter: {
          code: SEARCH_PARAMETER.RECORDED_DATE,
          operator: Operator.MISSING,
          value: "false",
        },
        sortRules: [{ code: SEARCH_PARAMETER.RECORDED_DATE, descending: true }],
      },
      {
        dateFilter: {
          code: SEARCH_PARAMETER.RECORDED_DATE,
          operator: Operator.MISSING,
          value: "true",
        },
        sortRules: [{ code: SEARCH_PARAMETER.ID, descending: false }],
      },
    ]);
  });

  it("opens a record in a dialog with its value, and closes it back onto the record", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    await createObservation(
      medplum,
      OBSERVATION_CATEGORY.VITAL_SIGNS,
      "Blood pressure",
      { effectiveDateTime: "2026-10-20" },
    );

    renderHealthRecords(medplum);
    await screen.findByTestId("conditions-empty");
    const panel = await openTab(user, "measurements");
    const viewRecord = await within(panel).findByRole("button", {
      name: "View record: Blood pressure",
    });
    await user.click(viewRecord);

    const dialog = await screen.findByTestId("health-record-dialog");
    expect(dialog).toHaveRole("dialog");
    expect(dialog).toHaveAccessibleName("Blood pressure");
    expect(within(dialog).getByTestId("health-record-value")).toHaveTextContent(
      "118 mmHg / 76 mmHg",
    );
    expect(
      within(dialog).getByTestId("health-record-details"),
    ).toHaveTextContent(
      "PatientHomer SimpsonDateOctober 20, 2026AuthorDr. Mira Synthetic",
    );

    await user.click(within(dialog).getByTestId("health-record-close"));
    await waitFor(() =>
      expect(
        screen.queryByTestId("health-record-dialog"),
      ).not.toBeInTheDocument(),
    );
    expect(viewRecord).toHaveFocus();
  });

  it("shows an error and marks the kind of record that could not be read, keeping the others", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    await createAllergyIntolerance(
      medplum,
      { text: "Penicillin" },
      "2024-03-12",
    );
    failSearches(
      medplum,
      (resourceType) => resourceType === RESOURCE_TYPE.CONDITION,
    );

    renderHealthRecords(medplum);

    expect(await screen.findByTestId("health-records-error")).toHaveTextContent(
      constant.DEFAULT_ERROR_MESSAGE,
    );
    expect(screen.getByTestId("conditions-unavailable")).toHaveTextContent(
      "Could not load",
    );
    expect(
      await within(await openTab(user, "allergies")).findByTestId(
        "allergies-record",
      ),
    ).toHaveTextContent("Penicillin");
  });

  it("keeps the records already listed when the next page cannot be read, and reads that page when the patient tries again", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    const conditionCount = constant.SEARCH_PAGE_SIZE + 1;
    for (let index = 0; index < conditionCount; index += 1) {
      await createCondition(
        medplum,
        `Condition ${index + 1}`,
        new Date(Date.UTC(2020, 0, 1 + index)).toISOString().slice(0, 10),
      );
    }
    let isRecordReachable = true;
    failSearches(medplum, () => !isRecordReachable);

    renderHealthRecords(medplum);
    const list = await screen.findByTestId("conditions-list");
    isRecordReachable = false;
    await user.click(screen.getByTestId("conditions-more"));

    const error = await screen.findByTestId("health-records-error");
    expect(within(list).getAllByTestId("conditions-record")).toHaveLength(
      constant.SEARCH_PAGE_SIZE,
    );
    expect(
      screen.queryByTestId("conditions-unavailable"),
    ).not.toBeInTheDocument();
    isRecordReachable = true;
    await user.click(within(error).getByRole("button"));

    await waitFor(() =>
      expect(within(list).getAllByTestId("conditions-record")).toHaveLength(
        conditionCount,
      ),
    );
    expect(
      screen.queryByTestId("health-records-error"),
    ).not.toBeInTheDocument();
  });

  it("reads the records again when the patient chooses to try again", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    await createCondition(medplum, "Eczema", "2026-10-20");
    let isRecordReachable = false;
    failSearches(medplum, () => !isRecordReachable);

    renderHealthRecords(medplum);
    const error = await screen.findByTestId("health-records-error");
    isRecordReachable = true;
    await user.click(within(error).getByRole("button"));

    const list = await screen.findByTestId("conditions-list");
    expect(listRecordTitles(list, "conditions")).toEqual(["Eczema"]);
    expect(
      screen.queryByTestId("health-records-error"),
    ).not.toBeInTheDocument();
  });

  it("moves between the tabs with the arrow keys", async () => {
    const user = userEvent.setup();
    renderHealthRecords(new MockClient({ profile: HomerSimpson }));

    await screen.findByTestId("conditions-empty");
    await user.click(screen.getByTestId("conditions-tab"));
    // Base Web reads the deprecated keyCode, which user-event leaves at 0; browsers set it.
    fireEvent.keyDown(screen.getByTestId("conditions-tab"), {
      key: "ArrowRight",
      keyCode: 39,
    });

    expect(screen.getByTestId("allergies-tab")).toHaveFocus();
    expect(screen.getByTestId("allergies-tab")).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("reads a kind of record only once its tab is opened", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    const searchResources = vi.spyOn(medplum, "searchResources");
    const listSearchedResourceTypes = () => [
      ...new Set(
        searchResources.mock.calls.map(([resourceType]) => resourceType),
      ),
    ];

    renderHealthRecords(medplum);
    await screen.findByTestId("conditions-empty");
    expect(listSearchedResourceTypes()).toEqual([RESOURCE_TYPE.CONDITION]);

    await within(await openTab(user, "allergies")).findByTestId(
      "allergies-empty",
    );
    await openTab(user, "conditions");
    expect(listSearchedResourceTypes()).toEqual([
      RESOURCE_TYPE.CONDITION,
      RESOURCE_TYPE.ALLERGY_INTOLERANCE,
    ]);
  });

  it("asks Medplum without its cache, and only with search parameters that each resource type defines", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    const searchResources = vi.spyOn(medplum, "searchResources");

    renderHealthRecords(medplum);
    await screen.findByTestId("conditions-empty");
    await within(await openTab(user, "allergies")).findByTestId(
      "allergies-empty",
    );
    await within(await openTab(user, "measurements")).findByTestId(
      "measurements-empty",
    );

    expect(
      new Set(searchResources.mock.calls.map(([resourceType]) => resourceType)),
    ).toEqual(
      new Set([
        RESOURCE_TYPE.CONDITION,
        RESOURCE_TYPE.ALLERGY_INTOLERANCE,
        RESOURCE_TYPE.OBSERVATION,
      ]),
    );
    for (const [resourceType, query, options] of searchResources.mock.calls) {
      expect(options).toEqual(expect.objectContaining({ cache: "reload" }));
      const searchRequest = parseSearchRequest(
        `${resourceType}${String(query)}`,
      );
      const searchParameterNames = [
        ...(searchRequest.filters ?? []).map(({ code }) => code),
        ...(searchRequest.sortRules ?? []).map(({ code }) => code),
      ];
      for (const searchParameterName of searchParameterNames) {
        expect(
          getSearchParameter(resourceType, searchParameterName),
          `${resourceType} ${searchParameterName}`,
        ).toBeDefined();
      }
    }
  });

  it("tells a screen reader when a tab's records arrive", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    await createCondition(medplum, "Eczema", "2026-10-20");

    renderHealthRecords(medplum);

    const content = screen.getByTestId("conditions-content");
    expect(content).toHaveAttribute("aria-live", "polite");
    expect(within(content).getByTestId("conditions-loading")).toBeVisible();
    expect(
      await within(content).findByTestId("conditions-list"),
    ).toBeInTheDocument();
  });

  it("opens the tab named in the address and reads only that tab's records", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    await createAllergyIntolerance(
      medplum,
      { text: "Penicillin" },
      "2026-10-20",
    );
    const searchResources = vi.spyOn(medplum, "searchResources");

    renderHealthRecords(medplum, "/health-records?tab=allergies");

    expect(screen.getByTestId("allergies-tab")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const panel = screen.getByTestId("allergies-panel");
    expect(
      await within(panel).findAllByTestId("allergies-record"),
    ).toHaveLength(1);
    expect(
      new Set(searchResources.mock.calls.map(([resourceType]) => resourceType)),
    ).toEqual(new Set([RESOURCE_TYPE.ALLERGY_INTOLERANCE]));
  });

  it.each([
    ["names no tab", "/health-records"],
    ["names a tab that does not exist", "/health-records?tab=procedures"],
  ])("opens Conditions when the address %s", async (_, path) => {
    renderHealthRecords(new MockClient({ profile: HomerSimpson }), path);

    expect(screen.getByTestId("conditions-tab")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(await screen.findByTestId("conditions-empty")).toBeInTheDocument();
  });

  it("keeps the open tab in the address, beside the rest of the address and its history state, without adding a history entry", async () => {
    const user = userEvent.setup();
    const historyState = { openedFrom: routes.HEALTH_PROFILE };
    const { router } = renderHealthRecords(
      new MockClient({ profile: HomerSimpson }),
      {
        pathname: routes.HEALTH_RECORDS,
        search: "?utm_source=reminder",
        hash: "#records",
        state: historyState,
      },
    );
    await screen.findByTestId("conditions-empty");

    await openTab(user, "measurements");

    expect(router.state.location.pathname).toBe(routes.HEALTH_RECORDS);
    expect(router.state.location.search).toBe(
      "?utm_source=reminder&tab=measurements",
    );
    expect(router.state.location.hash).toBe("#records");
    expect(router.state.location.state).toEqual(historyState);
    expect(router.state.historyAction).toBe("REPLACE");
    expect(screen.getByTestId("measurements-tab")).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
