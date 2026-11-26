import {
  createReference,
  forbidden,
  getReferenceString,
  getStatus,
  Operator,
  parseSearchRequest,
} from "@medplum/core";
import type {
  Bundle,
  CarePlan,
  Condition,
  HumanName,
  List,
  MedicationRequest,
} from "@medplum/fhirtypes";
import { HomerSimpson, MockClient } from "@medplum/mock";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import constant from "../../constants";
import {
  APPOINTMENT_STATUS,
  CARE_PLAN_INTENT,
  CARE_PLAN_STATUS,
  HUMAN_NAME_USE,
  LIST_MODE,
  LIST_STATUS,
  MEDICATION_REQUEST_INTENT,
  MEDICATION_REQUEST_STATUS,
  PATIENT_RECORD_SEARCHES,
  RESOURCE_TYPE,
  SEARCH_PARAMETER,
  SEARCH_TOTAL,
  SEARCH_VALUE_SEPARATOR,
} from "../../constants/fhir";
import {
  AppointmentProvider,
  CarePlanProvider,
  RecordSourceProvider,
} from "../../providers";
import {
  addListedOrganizations,
  createAppointment,
  createCarePlan,
  createRecordSources,
  doctor,
  includeListedOrganizations,
  interceptBatches,
  interceptSearches,
  mapleDental,
  networkFailure,
  oakDermatology,
  RECEIVED_AT,
  receiveRecordsAt,
} from "../../test-medplum";
import { TestProviders } from "../../test-providers";
import { showDatesInChicago } from "../../test-time-zone";
import Home from "./home.page";

const homeInsideProviders = (medplum: MockClient, isHomeShown = true) => (
  <TestProviders medplum={medplum}>
    <CarePlanProvider>
      <AppointmentProvider>
        <RecordSourceProvider>
          {isHomeShown ? <Home /> : null}
        </RecordSourceProvider>
      </AppointmentProvider>
    </CarePlanProvider>
  </TestProviders>
);

const renderHome = (medplum: MockClient) =>
  render(homeInsideProviders(medplum));

const createCarePlanFromAnotherClient = (
  medplum: MockClient,
  status: CarePlan["status"],
): Promise<CarePlan> =>
  medplum.repo.createResource<CarePlan>({
    resourceType: RESOURCE_TYPE.CARE_PLAN,
    status,
    intent: CARE_PLAN_INTENT.PLAN,
    subject: createReference(HomerSimpson),
  });

const dentist = { display: "Dr. Lena Synthetic" };

const createPlan = (medplum: MockClient, overrides: Partial<CarePlan>) =>
  medplum.createResource<CarePlan>({
    resourceType: RESOURCE_TYPE.CARE_PLAN,
    status: CARE_PLAN_STATUS.ACTIVE,
    intent: CARE_PLAN_INTENT.PLAN,
    subject: createReference(HomerSimpson),
    ...overrides,
  });

const listCarePlanTexts = () =>
  within(screen.getByTestId("current-care-list"))
    .getAllByTestId("current-care-plan")
    .map((row) => row.textContent);

const failBatches = (medplum: MockClient) =>
  interceptBatches(medplum, () => Promise.reject(networkFailure()));

const readSearchFilters = (resourceType: string, query: unknown) =>
  parseSearchRequest(`${resourceType}${String(query)}`).filters ?? [];

const isOtherCarePlanSearch = (resourceType: string, query: unknown) =>
  readSearchFilters(resourceType, query).some(
    ({ code, operator }) =>
      code === SEARCH_PARAMETER.STATUS && operator === Operator.NOT,
  );

const daysFromNow = (days: number, hours: number, minutes: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hours, minutes, 0, 0);
  return date;
};

const formatVisitDay = (start: Date) =>
  start.toLocaleDateString(constant.LOCALE, { month: "short", day: "numeric" });

const failSearches = (
  medplum: MockClient,
  shouldFail: (resourceType: string) => boolean,
) => {
  const search = medplum.search.bind(medplum);
  return vi
    .spyOn(medplum, "search")
    .mockImplementation(((resourceType, query, options) =>
      shouldFail(resourceType)
        ? Promise.reject(new TypeError("Failed to fetch"))
        : search(resourceType, query, options)) as typeof medplum.search);
};

describe("Home", () => {
  it("shows whose record it is and greets the patient by their given name", async () => {
    renderHome(new MockClient({ profile: HomerSimpson }));

    expect(screen.getByTestId("home-record-owner")).toHaveTextContent(
      "Your record · Homer Simpson",
    );
    expect(screen.getByTestId("home-greeting")).toHaveTextContent(
      "Hello, Homer",
    );
    expect(await screen.findByTestId("active-care-plans")).toBeInTheDocument();
  });

  it.each<[string, HumanName[] | undefined, string, string]>([
    [
      "the official name when a maiden name is listed first",
      [
        { use: HUMAN_NAME_USE.MAIDEN, given: ["Eleanor"], family: "Hart" },
        { use: HUMAN_NAME_USE.OFFICIAL, given: ["Eleanor"], family: "Walsh" },
      ],
      "Hello, Eleanor",
      "Your record · Eleanor Walsh",
    ],
    [
      "the usual name when there is no official one",
      [
        { use: HUMAN_NAME_USE.OLD, given: ["Daniel"], family: "Synthetic" },
        { use: HUMAN_NAME_USE.USUAL, given: ["Dana"], family: "Synthetic" },
      ],
      "Hello, Dana",
      "Your record · Dana Synthetic",
    ],
    [
      "the official name over a usual one listed before it",
      [
        { use: HUMAN_NAME_USE.USUAL, given: ["Ellie"], family: "Walsh" },
        { use: HUMAN_NAME_USE.OFFICIAL, given: ["Eleanor"], family: "Walsh" },
      ],
      "Hello, Eleanor",
      "Your record · Eleanor Walsh",
    ],
    [
      "the first name not marked old or maiden when none is official or usual",
      [
        { use: HUMAN_NAME_USE.OLD, given: ["Daniel"], family: "Synthetic" },
        { given: ["Dana"], family: "Synthetic" },
      ],
      "Hello, Dana",
      "Your record · Dana Synthetic",
    ],
    [
      "no name when every name is old or maiden",
      [
        { use: HUMAN_NAME_USE.MAIDEN, given: ["Eleanor"], family: "Hart" },
        { use: HUMAN_NAME_USE.OLD, given: ["Ellie"], family: "Hart" },
      ],
      "Hello",
      "Your record",
    ],
    ["no name when the record has none", undefined, "Hello", "Your record"],
  ])("greets the patient by %s", (_, name, greeting, recordOwner) => {
    renderHome(new MockClient({ profile: { ...HomerSimpson, name } }));

    expect(screen.getByTestId("home-greeting")).toHaveTextContent(
      new RegExp(`^${greeting}$`),
    );
    expect(screen.getByTestId("home-record-owner")).toHaveTextContent(
      new RegExp(`^${recordOwner}$`),
    );
  });

  it("shows loading in each fact until the record answers", async () => {
    renderHome(new MockClient({ profile: HomerSimpson }));

    expect(screen.getByTestId("active-care-plans-loading")).toHaveTextContent(
      "Loading…",
    );
    expect(screen.getByTestId("next-visit-loading")).toHaveTextContent(
      "Loading…",
    );
    expect(await screen.findByTestId("next-visit")).toBeInTheDocument();
  });

  it("lists the facts as terms and values in a region that announces them when they load", async () => {
    renderHome(new MockClient({ profile: HomerSimpson }));

    const overview = screen.getByTestId("home-overview");
    expect(overview.tagName).toBe("DL");
    expect(overview).toHaveAttribute("aria-live", "polite");
    expect(await screen.findByTestId("active-care-plans")).toHaveRole(
      "definition",
    );
    expect(screen.getByTestId("next-visit")).toHaveRole("definition");
  });

  it("shows that a patient with no plans, sources or visits has no ongoing plans, no sources, no visit booked and no care plans", async () => {
    renderHome(new MockClient({ profile: HomerSimpson }));

    expect(await screen.findByTestId("active-care-plans")).toHaveTextContent(
      "No ongoing plans",
    );
    expect(await screen.findByTestId("available-sources")).toHaveTextContent(
      "No sources",
    );
    expect(screen.getByTestId("next-visit")).toHaveTextContent("None booked");
    expect(await screen.findByTestId("current-care-empty")).toHaveTextContent(
      "No care plans available",
    );
  });

  it("says no records were received when Medplum has none of the patient's records", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    interceptBatches(medplum, async (executeBatch) => {
      const response = await executeBatch();
      return {
        ...response,
        entry: (response.entry ?? []).map((entry) => ({
          ...entry,
          resource: { ...(entry.resource as Bundle), entry: [] },
        })),
      };
    });

    renderHome(medplum);

    expect(await screen.findByTestId("last-received")).toHaveTextContent(
      /^No records received yet\.$/,
    );
  });

  it("keeps saying no records were received when reading it again fails on a return to Home", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    let isRecordReachable = true;
    interceptBatches(medplum, async (executeBatch) => {
      if (!isRecordReachable) {
        throw networkFailure();
      }
      const response = await executeBatch();
      return {
        ...response,
        entry: (response.entry ?? []).map((entry) => ({
          ...entry,
          resource: { ...(entry.resource as Bundle), entry: [] },
        })),
      };
    });

    const { rerender } = render(homeInsideProviders(medplum));
    expect(await screen.findByTestId("last-received")).toHaveTextContent(
      /^No records received yet\.$/,
    );
    rerender(homeInsideProviders(medplum, false));
    isRecordReachable = false;
    rerender(homeInsideProviders(medplum));

    expect(
      await screen.findByTestId("home-overview-error"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("last-received")).toHaveTextContent(
      /^No records received yet\.$/,
    );
    expect(
      screen.queryByTestId("last-received-unavailable"),
    ).not.toBeInTheDocument();
  });

  it("counts the clinics the patient's records come from, each once", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    const { entry = [] } = await createRecordSources(medplum, [
      oakDermatology,
      mapleDental,
    ]);
    await medplum.createResource<List>({
      resourceType: RESOURCE_TYPE.LIST,
      status: LIST_STATUS.CURRENT,
      mode: LIST_MODE.WORKING,
      subject: createReference(HomerSimpson),
      entry: [...entry, ...entry],
    });
    includeListedOrganizations(medplum);

    renderHome(medplum);

    await waitFor(() =>
      expect(screen.getByTestId("available-sources")).toHaveTextContent(
        "2 sources",
      ),
    );
  });

  it("counts a single clinic in the singular", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    await createRecordSources(medplum, [oakDermatology]);
    includeListedOrganizations(medplum);

    renderHome(medplum);

    await waitFor(() =>
      expect(screen.getByTestId("available-sources")).toHaveTextContent(
        "1 source",
      ),
    );
  });

  it("lists the patient's ongoing care plans first and then the others, each newest first, with its clinic, date, author and status, none entered in error, at most three", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    await createRecordSources(medplum, [oakDermatology, mapleDental]);
    includeListedOrganizations(medplum);
    await createPlan(medplum, {
      title: "Dental checkup",
      status: CARE_PLAN_STATUS.COMPLETED,
      period: { start: "2025-04-08", end: "2025-04-08" },
      author: dentist,
      meta: { source: mapleDental.address },
    });
    await createPlan(medplum, {
      title: "Eczema care",
      period: { start: "2026-10-20" },
      author: doctor,
      meta: { source: oakDermatology.address },
    });
    await createPlan(medplum, {
      category: [{ text: "Weight management" }],
      status: CARE_PLAN_STATUS.ON_HOLD,
    });
    await createPlan(medplum, {
      title: "Mistaken plan",
      status: CARE_PLAN_STATUS.ENTERED_IN_ERROR,
      period: { start: "2026-10-25" },
    });
    await createPlan(medplum, {
      title: "Flu season care",
      period: { start: "2019-10-01" },
    });

    renderHome(medplum);

    await waitFor(() =>
      expect(listCarePlanTexts()).toEqual([
        "Eczema careOak Synthetic Dermatology · October 20, 2026Dr. Mira SyntheticActive",
        "Flu season careOctober 1, 2019Active",
        "Dental checkupMaple Synthetic Dental · April 8, 2025Dr. Lena SyntheticCompleted",
      ]),
    );
    const currentCare = screen.getByTestId("current-care-section");
    expect(currentCare).toHaveRole("region");
    expect(currentCare).toHaveAccessibleName("Current care");
    expect(screen.getByTestId("current-care-list").tagName).toBe("UL");
  });

  it("never hides an ongoing plan behind newer plans that are done or stopped, and gives no place to a draft", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    await createPlan(medplum, {
      title: "Eczema care",
      period: { start: "2024-01-15" },
    });
    for (const [title, status, start] of [
      ["Dental checkup", CARE_PLAN_STATUS.COMPLETED, "2025-04-08"],
      ["Physiotherapy", CARE_PLAN_STATUS.REVOKED, "2025-06-02"],
      ["Diet", CARE_PLAN_STATUS.DRAFT, "2026-01-10"],
    ] as const) {
      await createPlan(medplum, { title, status, period: { start } });
    }

    renderHome(medplum);

    await waitFor(() =>
      expect(listCarePlanTexts()).toEqual([
        "Eczema careJanuary 15, 2024Active",
        "PhysiotherapyJune 2, 2025Revoked",
        "Dental checkupApril 8, 2025Completed",
      ]),
    );
  });

  it("lists only the plans agreed with the patient: none only proposed or offered as an option, and no draft", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    for (const [title, intent, status] of [
      ["Eczema care", CARE_PLAN_INTENT.ORDER, CARE_PLAN_STATUS.ACTIVE],
      ["Skin biopsy", CARE_PLAN_INTENT.PROPOSAL, CARE_PLAN_STATUS.ACTIVE],
      ["Light therapy", CARE_PLAN_INTENT.OPTION, CARE_PLAN_STATUS.ACTIVE],
      [
        "Allergy testing",
        CARE_PLAN_INTENT.PROPOSAL,
        CARE_PLAN_STATUS.COMPLETED,
      ],
      ["Diet", CARE_PLAN_INTENT.PLAN, CARE_PLAN_STATUS.DRAFT],
    ] as const) {
      await createPlan(medplum, {
        title,
        intent,
        status,
        period: { start: "2026-10-20" },
      });
    }

    renderHome(medplum);

    await waitFor(() =>
      expect(listCarePlanTexts()).toEqual([
        "Eczema careOctober 20, 2026Active",
      ]),
    );
  });

  it("lists a plan once when its clinic completes it while Home asks for the patient's plans", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    const eczemaCare = await createPlan(medplum, {
      title: "Eczema care",
      period: { start: "2026-10-20" },
    });
    interceptSearches(medplum, async (search, resourceType, query) => {
      if (isOtherCarePlanSearch(resourceType, query)) {
        await medplum.updateResource<CarePlan>({
          ...eczemaCare,
          status: CARE_PLAN_STATUS.COMPLETED,
        });
      }
      return search();
    });

    renderHome(medplum);

    await waitFor(() =>
      expect(listCarePlanTexts()).toEqual([
        "Eczema careOctober 20, 2026Active",
      ]),
    );
  });

  it("asks for no other plans when the ongoing ones fill Current care", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    for (const [title, start] of [
      ["Eczema care", "2026-10-20"],
      ["Physiotherapy", "2026-09-01"],
      ["Diet", "2026-08-15"],
    ] as const) {
      await createPlan(medplum, { title, period: { start } });
    }
    const search = vi.spyOn(medplum, "search");

    renderHome(medplum);

    await waitFor(() =>
      expect(listCarePlanTexts()).toEqual([
        "Eczema careOctober 20, 2026Active",
        "PhysiotherapySeptember 1, 2026Active",
        "DietAugust 15, 2026Active",
      ]),
    );
    expect(
      search.mock.calls.filter(([resourceType, query]) =>
        isOtherCarePlanSearch(resourceType, query),
      ),
    ).toEqual([]);
  });

  it("asks for the patient's ongoing plans agreed with them and then the others, newest first and the undated after, without counting them", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    const search = vi.spyOn(medplum, "search");

    renderHome(medplum);
    await screen.findByTestId("current-care-empty");

    const previewSearches = search.mock.calls
      .map(([resourceType, query]) =>
        parseSearchRequest(`${resourceType}${String(query)}`),
      )
      .filter(({ filters }) =>
        filters?.some(({ code }) => code === SEARCH_PARAMETER.DATE),
      );
    expect(
      previewSearches.map(({ filters, sortRules, count, total }) => ({
        count,
        filters,
        sortRules,
        total,
      })),
    ).toEqual(
      [
        [Operator.EQUALS, CARE_PLAN_STATUS.ACTIVE],
        [
          Operator.NOT,
          [
            CARE_PLAN_STATUS.ACTIVE,
            CARE_PLAN_STATUS.DRAFT,
            CARE_PLAN_STATUS.ENTERED_IN_ERROR,
          ].join(SEARCH_VALUE_SEPARATOR),
        ],
      ].flatMap(([operator, statuses]) =>
        [true, false].map((hasDate) => ({
          count: constant.SEARCH_PREVIEW_SIZE,
          filters: [
            {
              code: SEARCH_PARAMETER.DATE,
              operator: Operator.MISSING,
              value: String(!hasDate),
            },
            {
              code: SEARCH_PARAMETER.INTENT,
              operator: Operator.EQUALS,
              value: [CARE_PLAN_INTENT.PLAN, CARE_PLAN_INTENT.ORDER].join(
                SEARCH_VALUE_SEPARATOR,
              ),
            },
            { code: SEARCH_PARAMETER.STATUS, operator, value: statuses },
            {
              code: SEARCH_PARAMETER.SUBJECT,
              operator: Operator.EQUALS,
              value: getReferenceString(HomerSimpson),
            },
          ],
          sortRules: hasDate
            ? [{ code: SEARCH_PARAMETER.DATE, descending: true }]
            : [{ code: SEARCH_PARAMETER.ID, descending: false }],
          total: SEARCH_TOTAL.NONE,
        })),
      ),
    );
  });

  it("shows an error and marks the sources when only they cannot be read, and still lists the care plans", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    await createPlan(medplum, {
      title: "Eczema care",
      period: { start: "2026-10-20" },
    });
    interceptSearches(medplum, async (search, resourceType) => {
      if (resourceType === RESOURCE_TYPE.LIST) {
        throw networkFailure();
      }
      return search();
    });

    renderHome(medplum);

    expect(await screen.findByTestId("home-overview-error")).toHaveTextContent(
      constant.DEFAULT_ERROR_MESSAGE,
    );
    expect(
      await screen.findByTestId("available-sources-unavailable"),
    ).toHaveTextContent("Could not load");
    await waitFor(() =>
      expect(listCarePlanTexts()).toEqual([
        "Eczema careOctober 20, 2026Active",
      ]),
    );
    expect(await screen.findByTestId("active-care-plans")).toHaveTextContent(
      "1 ongoing plan",
    );
    expect(await screen.findByTestId("last-received")).toBeInTheDocument();
  });

  it.each([
    ["the ongoing plans with a date", Operator.EQUALS, true],
    ["the ongoing plans with no date", Operator.EQUALS, false],
    ["the other plans with a date", Operator.NOT, true],
    ["the other plans with no date", Operator.NOT, false],
  ] as const)(
    "shows an error and marks the care plans when only the search for %s fails, and still counts the ongoing ones",
    async (_, failedStatusOperator, isFailedSearchDated) => {
      const medplum = new MockClient({ profile: HomerSimpson });
      await createPlan(medplum, {
        title: "Eczema care",
        period: { start: "2026-10-20" },
      });
      interceptSearches(medplum, async (search, resourceType, query) => {
        const filters = readSearchFilters(resourceType, query);
        const isFailedSearch =
          filters.some(
            ({ code, operator }) =>
              code === SEARCH_PARAMETER.STATUS &&
              operator === failedStatusOperator,
          ) &&
          filters.some(
            ({ code, value }) =>
              code === SEARCH_PARAMETER.DATE &&
              value === String(!isFailedSearchDated),
          );
        if (isFailedSearch) {
          throw networkFailure();
        }
        return search();
      });

      renderHome(medplum);

      expect(
        await screen.findByTestId("current-care-unavailable"),
      ).toHaveTextContent("Could not load");
      expect(screen.getByTestId("home-overview-error")).toBeInTheDocument();
      expect(await screen.findByTestId("active-care-plans")).toHaveTextContent(
        "1 ongoing plan",
      );
      expect(
        await screen.findByTestId("available-sources"),
      ).toBeInTheDocument();
    },
  );

  it("keeps the sources, the care plans and when records were received on screen when reading them again fails on a return to Home", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    await createRecordSources(medplum, [oakDermatology]);
    await createPlan(medplum, {
      title: "Eczema care",
      period: { start: "2026-10-20" },
      meta: { source: oakDermatology.address },
    });
    let isRecordReachable = true;
    interceptSearches(medplum, async (search, resourceType) => {
      if (!isRecordReachable) {
        throw networkFailure();
      }
      return addListedOrganizations(medplum, await search(), resourceType);
    });
    interceptBatches(medplum, (executeBatch) =>
      isRecordReachable ? executeBatch() : Promise.reject(networkFailure()),
    );

    const { rerender } = render(homeInsideProviders(medplum));
    await waitFor(() =>
      expect(screen.getByTestId("available-sources")).toHaveTextContent(
        "1 source",
      ),
    );
    await screen.findByTestId("current-care-list");
    const received = (await screen.findByTestId("last-received")).textContent;
    rerender(homeInsideProviders(medplum, false));
    isRecordReachable = false;
    rerender(homeInsideProviders(medplum));

    expect(
      await screen.findByTestId("home-overview-error"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("available-sources")).toHaveTextContent(
      "1 source",
    );
    expect(listCarePlanTexts()).toEqual([
      "Eczema careOak Synthetic Dermatology · October 20, 2026Active",
    ]);
    expect(screen.getByTestId("last-received")).toHaveTextContent(
      received ?? "",
    );
    for (const testIdentifier of [
      "available-sources",
      "current-care",
      "last-received",
    ]) {
      expect(
        screen.queryByTestId(`${testIdentifier}-unavailable`),
      ).not.toBeInTheDocument();
    }
  });

  it("names a plan with no title by its category, else as a care plan, and lists it after the dated ones", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    await createPlan(medplum, { category: [{ text: "Weight management" }] });
    await createPlan(medplum, {
      title: "Eczema care",
      period: { start: "2026-10-20" },
    });

    renderHome(medplum);

    await waitFor(() =>
      expect(listCarePlanTexts()).toEqual([
        "Eczema careOctober 20, 2026Active",
        "Weight managementActive",
      ]),
    );
  });

  it("says when the portal last received any of the patient's records, in their time zone, and not another patient's", async () => {
    receiveRecordsAt(RECEIVED_AT);
    showDatesInChicago();
    const medplum = new MockClient({ profile: HomerSimpson });
    await medplum.createResource<Condition>({
      resourceType: RESOURCE_TYPE.CONDITION,
      subject: createReference(HomerSimpson),
      code: { text: "Eczema" },
    });
    vi.setSystemTime("2026-10-30T03:00:00.000Z");
    await medplum.createResource<MedicationRequest>({
      resourceType: RESOURCE_TYPE.MEDICATION_REQUEST,
      status: MEDICATION_REQUEST_STATUS.ACTIVE,
      intent: MEDICATION_REQUEST_INTENT.ORDER,
      subject: createReference(HomerSimpson),
      medicationCodeableConcept: { text: "Triamcinolone 0.1% cream" },
    });
    vi.setSystemTime("2026-11-05T12:00:00.000Z");
    await medplum.createResource<Condition>({
      resourceType: RESOURCE_TYPE.CONDITION,
      subject: {
        reference: getReferenceString({
          resourceType: RESOURCE_TYPE.PATIENT,
          id: "another-patient",
        }),
      },
      code: { text: "Asthma" },
    });

    renderHome(medplum);

    expect(await screen.findByTestId("last-received")).toHaveTextContent(
      "Received Oct 29, 2026. This may not be a complete or current record.",
    );
    const connectedRecords = screen.getByTestId("connected-records-section");
    expect(connectedRecords).toHaveRole("region");
    expect(connectedRecords).toHaveAccessibleName("Connected records");
    expect(connectedRecords).toHaveTextContent(
      "Available records from participating sources.",
    );
  });

  it("asks for the newest record of each type the patient may read, in one batch, limited to the patient", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    const executeBatch = vi.spyOn(medplum, "executeBatch");

    renderHome(medplum);
    await screen.findByTestId("last-received");

    expect(executeBatch).toHaveBeenCalledTimes(1);
    const [[bundle]] = executeBatch.mock.calls;
    expect(
      (bundle.entry ?? []).map(({ request }) => {
        const { filters, sortRules, count, resourceType } = parseSearchRequest(
          request?.url ?? "",
        );
        return { count, filters, resourceType, sortRules };
      }),
    ).toEqual(
      [
        [RESOURCE_TYPE.ALLERGY_INTOLERANCE, SEARCH_PARAMETER.PATIENT],
        [RESOURCE_TYPE.APPOINTMENT, SEARCH_PARAMETER.PATIENT],
        [RESOURCE_TYPE.CARE_PLAN, SEARCH_PARAMETER.SUBJECT],
        [RESOURCE_TYPE.CONDITION, SEARCH_PARAMETER.PATIENT],
        [RESOURCE_TYPE.DIAGNOSTIC_REPORT, SEARCH_PARAMETER.PATIENT],
        [RESOURCE_TYPE.MEDICATION_REQUEST, SEARCH_PARAMETER.PATIENT],
        [RESOURCE_TYPE.OBSERVATION, SEARCH_PARAMETER.PATIENT],
        [RESOURCE_TYPE.PROCEDURE, SEARCH_PARAMETER.PATIENT],
      ].map(([resourceType, code]) => ({
        count: 1,
        filters: [
          {
            code,
            operator: Operator.EQUALS,
            value: getReferenceString(HomerSimpson),
          },
        ],
        resourceType,
        sortRules: [{ code: SEARCH_PARAMETER.LAST_UPDATED, descending: true }],
      })),
    );
  });

  it.each(
    PATIENT_RECORD_SEARCHES.map(({ resourceType }, index) => [
      resourceType,
      index,
    ]),
  )(
    "shows an error when Medplum refuses the %s search in the batch, and marks when records were received",
    async (_, refusedIndex) => {
      const medplum = new MockClient({ profile: HomerSimpson });
      interceptBatches(medplum, async (executeBatch) => {
        const response = await executeBatch();
        return {
          ...response,
          entry: (response.entry ?? []).map((entry, index) =>
            index === refusedIndex
              ? {
                  response: {
                    status: String(getStatus(forbidden)),
                    outcome: forbidden,
                  },
                }
              : entry,
          ),
        };
      });

      renderHome(medplum);

      expect(
        await screen.findByTestId("home-overview-error"),
      ).toHaveTextContent("Forbidden");
      expect(screen.getByTestId("last-received-unavailable")).toHaveTextContent(
        "Could not load",
      );
      expect(screen.getByTestId("available-sources")).toBeInTheDocument();
    },
  );

  it("counts only active care plans", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    await createCarePlan(medplum, CARE_PLAN_STATUS.ACTIVE);
    await createCarePlan(medplum, CARE_PLAN_STATUS.COMPLETED);
    await createCarePlan(medplum, CARE_PLAN_STATUS.DRAFT);

    renderHome(medplum);

    expect(await screen.findByTestId("active-care-plans")).toHaveTextContent(
      "1 ongoing plan",
    );
  });

  it("counts several active care plans in the plural", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    await createCarePlan(medplum, CARE_PLAN_STATUS.ACTIVE);
    await createCarePlan(medplum, CARE_PLAN_STATUS.ACTIVE);

    renderHome(medplum);

    expect(await screen.findByTestId("active-care-plans")).toHaveTextContent(
      "2 ongoing plans",
    );
  });

  it("shows the earliest booked visit from now, skipping past and cancelled ones", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    await createAppointment(
      medplum,
      APPOINTMENT_STATUS.BOOKED,
      daysFromNow(-2, 9, 0),
    );
    await createAppointment(
      medplum,
      APPOINTMENT_STATUS.CANCELLED,
      daysFromNow(1, 8, 0),
    );
    await createAppointment(
      medplum,
      APPOINTMENT_STATUS.BOOKED,
      daysFromNow(9, 15, 0),
    );
    const nextVisitStart = daysFromNow(3, 10, 30);
    await createAppointment(medplum, APPOINTMENT_STATUS.BOOKED, nextVisitStart);

    renderHome(medplum);

    expect(await screen.findByTestId("next-visit")).toHaveTextContent(
      `${formatVisitDay(nextVisitStart)} · 10:30 AM`,
    );
  });

  it("shows an error and marks every part when the record cannot be read", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    failSearches(medplum, () => true);
    failBatches(medplum);

    renderHome(medplum);

    expect(await screen.findByTestId("home-overview-error")).toHaveTextContent(
      constant.DEFAULT_ERROR_MESSAGE,
    );
    for (const testIdentifier of [
      "active-care-plans",
      "available-sources",
      "next-visit",
      "current-care",
      "last-received",
    ]) {
      expect(
        await screen.findByTestId(`${testIdentifier}-unavailable`),
      ).toHaveTextContent("Could not load");
    }
  });

  it("keeps the fact that loaded when the other cannot be read", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    await createCarePlan(medplum, CARE_PLAN_STATUS.ACTIVE);
    failSearches(
      medplum,
      (resourceType) => resourceType === RESOURCE_TYPE.APPOINTMENT,
    );

    renderHome(medplum);

    expect(
      await screen.findByTestId("home-overview-error"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("active-care-plans")).toHaveTextContent(
      "1 ongoing plan",
    );
    expect(screen.getByTestId("next-visit-unavailable")).toBeInTheDocument();
  });

  it("reads the record again when the patient chooses to try again", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    await createCarePlan(medplum, CARE_PLAN_STATUS.ACTIVE);
    await createRecordSources(medplum, [oakDermatology]);
    let isRecordReachable = false;
    interceptSearches(medplum, async (search, resourceType) => {
      if (!isRecordReachable) {
        throw networkFailure();
      }
      return addListedOrganizations(medplum, await search(), resourceType);
    });
    interceptBatches(medplum, (executeBatch) =>
      isRecordReachable ? executeBatch() : Promise.reject(networkFailure()),
    );

    renderHome(medplum);
    const error = await screen.findByTestId("home-overview-error");
    isRecordReachable = true;
    await user.click(within(error).getByRole("button"));

    expect(await screen.findByTestId("active-care-plans")).toHaveTextContent(
      "1 ongoing plan",
    );
    expect(await screen.findByTestId("available-sources")).toHaveTextContent(
      "1 source",
    );
    expect(screen.getByTestId("next-visit")).toHaveTextContent("None booked");
    expect(await screen.findByTestId("current-care-list")).toBeInTheDocument();
    expect(await screen.findByTestId("last-received")).toBeInTheDocument();
    expect(screen.queryByTestId("home-overview-error")).not.toBeInTheDocument();
  });

  it("asks Medplum for the facts without its cache", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    const search = vi.spyOn(medplum, "search");

    renderHome(medplum);

    expect(await screen.findByTestId("next-visit")).toBeInTheDocument();
    expect(search).toHaveBeenCalledWith(
      RESOURCE_TYPE.CARE_PLAN,
      expect.any(String),
      expect.objectContaining({ cache: "reload" }),
    );
    expect(search).toHaveBeenCalledWith(
      RESOURCE_TYPE.APPOINTMENT,
      expect.anything(),
      expect.objectContaining({ cache: "reload" }),
    );
  });

  it("keeps the last facts on screen while it reads them again on a return to Home", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    await createCarePlan(medplum, CARE_PLAN_STATUS.ACTIVE);

    const { rerender } = render(homeInsideProviders(medplum));
    expect(await screen.findByTestId("active-care-plans")).toHaveTextContent(
      "1 ongoing plan",
    );
    rerender(homeInsideProviders(medplum, false));
    await createCarePlanFromAnotherClient(medplum, CARE_PLAN_STATUS.ACTIVE);
    rerender(homeInsideProviders(medplum));

    expect(screen.getByTestId("active-care-plans")).toHaveTextContent(
      "1 ongoing plan",
    );
    expect(
      screen.queryByTestId("active-care-plans-loading"),
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId("active-care-plans")).toHaveTextContent(
        "2 ongoing plans",
      ),
    );
  });

  it("keeps an empty next visit on screen while it reads it again on a return to Home", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });

    const { rerender } = render(homeInsideProviders(medplum));
    expect(await screen.findByTestId("next-visit")).toHaveTextContent(
      "None booked",
    );
    rerender(homeInsideProviders(medplum, false));
    const nextVisitStart = daysFromNow(3, 10, 30);
    await createAppointment(medplum, APPOINTMENT_STATUS.BOOKED, nextVisitStart);
    rerender(homeInsideProviders(medplum));

    expect(screen.getByTestId("next-visit")).toHaveTextContent("None booked");
    expect(screen.queryByTestId("next-visit-loading")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId("next-visit")).toHaveTextContent(
        `${formatVisitDay(nextVisitStart)} · 10:30 AM`,
      ),
    );
  });
});
