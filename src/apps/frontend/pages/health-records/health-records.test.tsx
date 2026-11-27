import {
  createReference,
  escapeSearchValue,
  formatSearchQuery,
  getReferenceString,
  getSearchParameter,
  Operator,
  parseSearchRequest,
  type SearchRequest,
} from "@medplum/core";
import type {
  Annotation,
  Bundle,
  Condition,
  Immunization,
  List,
  Observation,
  Organization,
  Patient,
  Procedure,
} from "@medplum/fhirtypes";
import { HomerSimpson, MockClient } from "@medplum/mock";
import {
  act,
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
  BUNDLE_LINK_RELATION,
  BUNDLE_TYPE,
  CODE_SYSTEM,
  CONDITION_CLINICAL_STATUS,
  CONDITION_VERIFICATION_STATUS,
  IDENTIFIER_SYSTEM,
  IMMUNIZATION_STATUS,
  LIST_MODE,
  LIST_STATUS,
  OBSERVATION_CATEGORY,
  OBSERVATION_STATUS,
  PROCEDURE_STATUS,
  RESOURCE_TYPE,
  SEARCH_ENTRY_MODE,
  SEARCH_PARAMETER,
  SEARCH_VALUE_SEPARATOR,
} from "../../constants/fhir";
import routes from "../../constants/routes";
import {
  AllergyIntoleranceProvider,
  ConditionProvider,
  ImmunizationProvider,
  ObservationProvider,
  ProcedureProvider,
  RecordSourceProvider,
} from "../../providers";
import {
  addListedOrganizations,
  codeFrom,
  createAllergyIntolerance,
  createRecordSources,
  doctor,
  harborLaboratory,
  includeListedOrganizations,
  interceptSearches,
  mapleDental,
  networkFailure,
  oakDermatology,
  readSearchRequest,
  RECEIVED_AT,
  receiveRecordsAt,
} from "../../test-medplum";
import { TestProviders } from "../../test-providers";
import {
  ALL_SOURCES,
  answerAsServer,
  chooseNextRecordSourceByKeyboard,
  chooseRecordSource,
  getSearchBox,
  getSourceMenu,
  isSourceFilter,
  isTextFilter,
  isVaccineCodeTextFilter,
  listFilterValues,
  listSourceOptionNames,
  searchRecords,
} from "../../test-record-filter";
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
              <ProcedureProvider>
                <ImmunizationProvider>
                  <ObservationProvider>
                    <HealthRecords />
                  </ObservationProvider>
                </ImmunizationProvider>
              </ProcedureProvider>
            </AllergyIntoleranceProvider>
          </ConditionProvider>
        ),
      },
    ],
    { initialEntries: [path] },
  );
  const result = render(
    <TestProviders medplum={medplum}>
      <RecordSourceProvider>
        <RouterProvider router={router} />
      </RecordSourceProvider>
    </TestProviders>,
  );
  return { ...result, router };
};

const pineFamilyClinic = {
  address: "https://fhir.pine-family-clinic.example",
  name: "Pine Synthetic Family Clinic",
};

const cedarCardiology = {
  address: "https://fhir.cedar-cardiology.example",
  name: "Cedar Synthetic Cardiology",
};

const createClinic = (
  medplum: MockClient,
  { address, name }: typeof oakDermatology,
  overrides: Partial<Organization> = {},
) =>
  medplum.createResource<Organization>({
    resourceType: RESOURCE_TYPE.ORGANIZATION,
    identifier: [{ system: IDENTIFIER_SYSTEM.URI, value: address }],
    name,
    ...overrides,
  });

const createSourceList = (medplum: MockClient, overrides: Partial<List>) =>
  medplum.createResource<List>({
    resourceType: RESOURCE_TYPE.LIST,
    status: LIST_STATUS.CURRENT,
    mode: LIST_MODE.WORKING,
    subject: homer,
    ...overrides,
  });

const serveListPages = (
  medplum: MockClient,
  lists: List[],
  isPageReachable: (pageIndex: number) => boolean,
) =>
  interceptSearches(medplum, async (search, resourceType, query) => {
    if (resourceType !== RESOURCE_TYPE.LIST) {
      return search();
    }
    const searchRequest = readSearchRequest(medplum, resourceType, query);
    const pageIndex = (searchRequest.offset ?? 0) / constant.SEARCH_PAGE_SIZE;
    if (!isPageReachable(pageIndex)) {
      throw networkFailure();
    }
    const nextPageIndex = pageIndex + 1;
    const listPage: Bundle = {
      resourceType: RESOURCE_TYPE.BUNDLE,
      type: BUNDLE_TYPE.SEARCHSET,
      entry: [
        {
          resource: lists[pageIndex],
          search: { mode: SEARCH_ENTRY_MODE.MATCH },
        },
      ],
      link:
        nextPageIndex < lists.length
          ? [
              {
                relation: BUNDLE_LINK_RELATION.NEXT,
                url: medplum
                  .fhirSearchUrl(
                    resourceType,
                    formatSearchQuery({
                      ...searchRequest,
                      offset: nextPageIndex * constant.SEARCH_PAGE_SIZE,
                    }),
                  )
                  .toString(),
              },
            ]
          : [],
    };
    return addListedOrganizations(medplum, listPage, resourceType);
  });

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

const createProcedure = (
  medplum: MockClient,
  name: string,
  performedDateTime: string | undefined,
  overrides: Partial<Procedure> = {},
): Promise<Procedure> =>
  medplum.createResource<Procedure>({
    resourceType: RESOURCE_TYPE.PROCEDURE,
    status: PROCEDURE_STATUS.COMPLETED,
    subject: homer,
    code: { text: name },
    performedDateTime,
    performer: [{ actor: doctor }],
    ...overrides,
  });

const createImmunization = (
  medplum: MockClient,
  name: string,
  occurrenceDateTime: string | undefined,
  overrides: Partial<Immunization> = {},
): Promise<Immunization> =>
  medplum.createResource<Immunization>({
    resourceType: RESOURCE_TYPE.IMMUNIZATION,
    status: IMMUNIZATION_STATUS.COMPLETED,
    patient: homer,
    vaccineCode: { text: name },
    occurrenceDateTime,
    performer: [{ actor: doctor }],
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
  const search = medplum.search.bind(medplum);
  return vi
    .spyOn(medplum, "search")
    .mockImplementation(((resourceType, query, options) =>
      shouldFail(resourceType)
        ? Promise.reject(new TypeError("Failed to fetch"))
        : search(resourceType, query, options)) as typeof medplum.search);
};

const openTab = async (
  user: ReturnType<typeof userEvent.setup>,
  tabKey: string,
) => {
  await user.click(screen.getByTestId(`${tabKey}-tab`));
  return screen.getByTestId(`${tabKey}-panel`);
};

const openConfirmedAllergyRecord = async (note: Annotation[] | undefined) => {
  const user = userEvent.setup();
  const medplum = new MockClient({ profile: HomerSimpson });
  await createAllergyIntolerance(
    medplum,
    { text: "Penicillin" },
    "2024-03-12",
    {
      verificationStatus: codeFrom(
        CODE_SYSTEM.ALLERGY_INTOLERANCE_VERIFICATION,
        ALLERGY_INTOLERANCE_VERIFICATION_STATUS.CONFIRMED,
      ),
      note,
    },
  );
  renderHealthRecords(medplum);
  await screen.findByTestId("conditions-empty");
  const panel = await openTab(user, "allergies");
  await user.click(
    await within(panel).findByRole("button", {
      name: "View record: Penicillin",
    }),
  );
  return screen.findByTestId("health-record-dialog");
};

const listNoteTexts = (dialog: HTMLElement) =>
  within(dialog)
    .queryAllByTestId("health-record-note")
    .map((note) => note.textContent);

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
      "Procedures",
      "Immunizations",
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

  it("names the clinic each record came from, and in the record when the portal received it", async () => {
    receiveRecordsAt(RECEIVED_AT);
    showDatesInChicago();
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    await createRecordSources(medplum, [oakDermatology, mapleDental]);
    includeListedOrganizations(medplum);
    await createCondition(medplum, "Eczema", "2026-10-20", {
      meta: { source: oakDermatology.address },
    });
    await createCondition(medplum, "Tooth decay", "2025-04-08", {
      meta: { source: mapleDental.address },
    });

    renderHealthRecords(medplum);

    const list = await screen.findByTestId("conditions-list");
    await waitFor(() =>
      expect(listRecordTexts(list, "conditions")).toEqual([
        "EczemaOak Synthetic Dermatology · October 20, 2026Dr. Mira SyntheticActiveView record",
        "Tooth decayMaple Synthetic Dental · April 8, 2025Dr. Mira SyntheticActiveView record",
      ]),
    );
    await user.click(
      within(list).getByRole("button", { name: "View record: Eczema" }),
    );
    expect(
      within(await screen.findByTestId("health-record-dialog")).getByTestId(
        "health-record-details",
      ),
    ).toHaveTextContent(
      "PatientHomer SimpsonSourceOak Synthetic DermatologyDateOctober 20, 2026ReceivedOctober 28, 2026 · 4:10 PM Central TimeAuthorDr. Mira Synthetic",
      { normalizeWhitespace: false },
    );
  });

  it("names the clinic once when the clinic itself recorded the measurement", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    await createRecordSources(medplum, [oakDermatology]);
    includeListedOrganizations(medplum);
    await createObservation(
      medplum,
      OBSERVATION_CATEGORY.VITAL_SIGNS,
      "Blood pressure",
      {
        effectiveDateTime: "2026-10-20",
        meta: { source: oakDermatology.address },
        performer: [{ display: oakDermatology.name }],
      },
    );

    renderHealthRecords(medplum);
    await screen.findByTestId("conditions-empty");
    const panel = await openTab(user, "measurements");

    await waitFor(() =>
      expect(listRecordTexts(panel, "measurements")).toEqual([
        "Blood pressureOak Synthetic Dermatology · October 20, 2026FinalView record",
      ]),
    );
  });

  it("names no clinic for a record whose source the patient's list does not name, or that names no source", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    await createRecordSources(medplum, [oakDermatology]);
    includeListedOrganizations(medplum);
    await createCondition(medplum, "Eczema", "2026-10-20", {
      meta: { source: mapleDental.address },
    });
    await createCondition(medplum, "Asthma", "2026-10-19");
    const search = vi.spyOn(medplum, "search");

    renderHealthRecords(medplum);

    const list = await screen.findByTestId("conditions-list");
    await waitFor(() =>
      expect(search.mock.calls.map(([resourceType]) => resourceType)).toContain(
        RESOURCE_TYPE.LIST,
      ),
    );
    await waitFor(() =>
      expect(listRecordTexts(list, "conditions")).toEqual([
        "EczemaOctober 20, 2026Dr. Mira SyntheticActiveView record",
        "AsthmaOctober 19, 2026Dr. Mira SyntheticActiveView record",
      ]),
    );
  });

  it("reads the clinics from the patient's own lists in use, with the clinics those lists name, once and without Medplum's cache", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    const search = vi.spyOn(medplum, "search");

    renderHealthRecords(medplum);
    await screen.findByTestId("conditions-empty");

    const listSearches = search.mock.calls.filter(
      ([resourceType]) => resourceType === RESOURCE_TYPE.LIST,
    );
    expect(listSearches).toHaveLength(1);
    const [[resourceType, query, options]] = listSearches;
    expect(readSearchRequest(medplum, resourceType, query)).toEqual({
      resourceType: RESOURCE_TYPE.LIST,
      filters: [
        {
          code: SEARCH_PARAMETER.STATUS,
          operator: Operator.EQUALS,
          value: LIST_STATUS.CURRENT,
        },
        {
          code: SEARCH_PARAMETER.SUBJECT,
          operator: Operator.EQUALS,
          value: getReferenceString(HomerSimpson),
        },
      ],
      include: [
        {
          resourceType: RESOURCE_TYPE.LIST,
          searchParam: SEARCH_PARAMETER.ITEM,
          targetType: RESOURCE_TYPE.ORGANIZATION,
        },
      ],
      count: constant.SEARCH_PAGE_SIZE,
    });
    expect(options).toEqual(expect.objectContaining({ cache: "reload" }));
  });

  it("names the clinics listed on every page of the patient's lists", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    const oakList = await createRecordSources(medplum, [oakDermatology]);
    const mapleList = await createRecordSources(medplum, [mapleDental]);
    await createCondition(medplum, "Tooth decay", "2025-04-08", {
      meta: { source: mapleDental.address },
    });
    serveListPages(medplum, [oakList, mapleList], () => true);

    renderHealthRecords(medplum);

    const list = await screen.findByTestId("conditions-list");
    await waitFor(() =>
      expect(listRecordTexts(list, "conditions")).toEqual([
        "Tooth decayMaple Synthetic Dental · April 8, 2025Dr. Mira SyntheticActiveView record",
      ]),
    );
  });

  it("shows an error when a later page of the patient's lists could not be read, and names every clinic once the patient tries again", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    const oakList = await createRecordSources(medplum, [oakDermatology]);
    const mapleList = await createRecordSources(medplum, [mapleDental]);
    await createCondition(medplum, "Eczema", "2026-10-20", {
      meta: { source: oakDermatology.address },
    });
    await createCondition(medplum, "Tooth decay", "2025-04-08", {
      meta: { source: mapleDental.address },
    });
    let isLaterPageReachable = false;
    serveListPages(
      medplum,
      [oakList, mapleList],
      (pageIndex) => pageIndex === 0 || isLaterPageReachable,
    );

    renderHealthRecords(medplum);

    const error = await screen.findByTestId("health-records-error");
    const list = screen.getByTestId("conditions-list");
    expect(listRecordTexts(list, "conditions")).toEqual([
      "EczemaOctober 20, 2026Dr. Mira SyntheticActiveView record",
      "Tooth decayApril 8, 2025Dr. Mira SyntheticActiveView record",
    ]);
    isLaterPageReachable = true;
    await user.click(
      within(screen.getByTestId("health-records-error-retry")).getByRole(
        "button",
      ),
    );

    await waitFor(() =>
      expect(listRecordTexts(list, "conditions")).toEqual([
        "EczemaOak Synthetic Dermatology · October 20, 2026Dr. Mira SyntheticActiveView record",
        "Tooth decayMaple Synthetic Dental · April 8, 2025Dr. Mira SyntheticActiveView record",
      ]),
    );
    expect(error).not.toBeInTheDocument();
  });

  it("shows an error with a way to try again when the clinics could not be read, and lists the records meanwhile", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    await createRecordSources(medplum, [oakDermatology]);
    await createCondition(medplum, "Eczema", "2026-10-20", {
      meta: { source: oakDermatology.address },
    });
    let areSourcesReachable = false;
    const search = interceptSearches(
      medplum,
      async (searchAgain, resourceType) => {
        if (resourceType === RESOURCE_TYPE.LIST && !areSourcesReachable) {
          throw networkFailure();
        }
        return addListedOrganizations(
          medplum,
          await searchAgain(),
          resourceType,
        );
      },
    );

    renderHealthRecords(medplum);

    expect(await screen.findByTestId("health-records-error")).toHaveTextContent(
      constant.DEFAULT_ERROR_MESSAGE,
    );
    const list = await screen.findByTestId("conditions-list");
    expect(listRecordTexts(list, "conditions")).toEqual([
      "EczemaOctober 20, 2026Dr. Mira SyntheticActiveView record",
    ]);
    const conditionSearchCount = search.mock.calls.filter(
      ([resourceType]) => resourceType === RESOURCE_TYPE.CONDITION,
    ).length;
    areSourcesReachable = true;
    await user.click(
      within(screen.getByTestId("health-records-error-retry")).getByRole(
        "button",
      ),
    );

    await waitFor(() =>
      expect(listRecordTexts(list, "conditions")).toEqual([
        "EczemaOak Synthetic Dermatology · October 20, 2026Dr. Mira SyntheticActiveView record",
      ]),
    );
    expect(
      screen.queryByTestId("health-records-error"),
    ).not.toBeInTheDocument();
    expect(
      search.mock.calls.filter(
        ([resourceType]) => resourceType === RESOURCE_TYPE.CONDITION,
      ),
    ).toHaveLength(conditionSearchCount);
  });

  it("names only the clinics on a list in use: not one that a list of changes removes, nor one on a retired, mistaken or snapshot list, though it names a clinic no longer active", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    const [oak, maple, harbor, pine, cedar] = await Promise.all([
      createClinic(medplum, oakDermatology),
      createClinic(medplum, mapleDental),
      createClinic(medplum, harborLaboratory, { active: false }),
      createClinic(medplum, pineFamilyClinic),
      createClinic(medplum, cedarCardiology),
    ]);
    await createSourceList(medplum, {
      entry: [
        { item: createReference(oak) },
        { item: createReference(harbor) },
      ],
    });
    await createSourceList(medplum, {
      mode: LIST_MODE.CHANGES,
      entry: [{ item: createReference(maple), deleted: true }],
    });
    await createSourceList(medplum, {
      status: LIST_STATUS.RETIRED,
      entry: [{ item: createReference(pine) }],
    });
    await createSourceList(medplum, {
      status: LIST_STATUS.ENTERED_IN_ERROR,
      entry: [{ item: createReference(pine) }],
    });
    await createSourceList(medplum, {
      mode: LIST_MODE.SNAPSHOT,
      entry: [{ item: createReference(cedar) }],
    });
    const search = includeListedOrganizations(medplum);
    for (const [name, source] of [
      ["Eczema", oakDermatology],
      ["Tooth decay", mapleDental],
      ["Anemia", harborLaboratory],
      ["Asthma", pineFamilyClinic],
      ["Hypertension", cedarCardiology],
    ] as const) {
      await createCondition(medplum, name, "2026-10-20", {
        meta: { source: source.address },
      });
    }

    renderHealthRecords(medplum);

    const list = await screen.findByTestId("conditions-list");
    await waitFor(() =>
      expect(listRecordTexts(list, "conditions")).toEqual(
        expect.arrayContaining([
          "EczemaOak Synthetic Dermatology · October 20, 2026Dr. Mira SyntheticActiveView record",
          "AnemiaHarbor Synthetic Laboratory · October 20, 2026Dr. Mira SyntheticActiveView record",
        ]),
      ),
    );
    expect(listRecordTexts(list, "conditions")).toEqual(
      expect.arrayContaining([
        "Tooth decayOctober 20, 2026Dr. Mira SyntheticActiveView record",
        "AsthmaOctober 20, 2026Dr. Mira SyntheticActiveView record",
        "HypertensionOctober 20, 2026Dr. Mira SyntheticActiveView record",
      ]),
    );
    const [[resourceType, query]] = search.mock.calls.filter(
      ([searchedType]) => searchedType === RESOURCE_TYPE.LIST,
    );
    expect(readSearchRequest(medplum, resourceType, query).filters).toEqual(
      expect.arrayContaining([
        {
          code: SEARCH_PARAMETER.STATUS,
          operator: Operator.EQUALS,
          value: LIST_STATUS.CURRENT,
        },
      ]),
    );
  });

  it("names a clinic at each of its addresses, and no clinic on a record whose address carries the request after a '#', which choosing the clinic would not list", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    const formerAddress = "https://fhir.oak-dermatology-former.example";
    const oak = await createClinic(medplum, oakDermatology, {
      identifier: [
        { system: IDENTIFIER_SYSTEM.URI, value: formerAddress },
        { system: IDENTIFIER_SYSTEM.URI, value: oakDermatology.address },
      ],
    });
    await createSourceList(medplum, {
      entry: [{ item: createReference(oak) }],
    });
    includeListedOrganizations(medplum);
    await createCondition(medplum, "Eczema", "2026-10-20", {
      meta: { source: oakDermatology.address },
    });
    await createCondition(medplum, "Rosacea", "2024-03-12", {
      meta: { source: formerAddress },
    });
    await createCondition(medplum, "Acne", "2023-05-01", {
      meta: {
        source: `${oakDermatology.address}#4f6b8a71-2c3d-4e5f-9a0b-1c2d3e4f5a6b`,
      },
    });

    renderHealthRecords(medplum);

    const list = await screen.findByTestId("conditions-list");
    await waitFor(() =>
      expect(listRecordTexts(list, "conditions")).toEqual([
        "EczemaOak Synthetic Dermatology · October 20, 2026Dr. Mira SyntheticActiveView record",
        "RosaceaOak Synthetic Dermatology · March 12, 2024Dr. Mira SyntheticActiveView record",
        "AcneMay 1, 2023Dr. Mira SyntheticActiveView record",
      ]),
    );
  });

  it("names the clinic in a record opened before the clinics arrived, once they arrive", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    await createRecordSources(medplum, [oakDermatology]);
    await createCondition(medplum, "Eczema", "2026-10-20", {
      meta: { source: oakDermatology.address },
    });
    let sendSources = () => {};
    const sourcesSent = new Promise<void>((resolve) => {
      sendSources = resolve;
    });
    interceptSearches(medplum, async (search, resourceType) => {
      if (resourceType === RESOURCE_TYPE.LIST) {
        await sourcesSent;
      }
      return addListedOrganizations(medplum, await search(), resourceType);
    });

    renderHealthRecords(medplum);
    const list = await screen.findByTestId("conditions-list");
    await user.click(
      within(list).getByRole("button", { name: "View record: Eczema" }),
    );
    const details = within(
      await screen.findByTestId("health-record-dialog"),
    ).getByTestId("health-record-details");
    expect(details).not.toHaveTextContent("Source");
    sendSources();

    await waitFor(() =>
      expect(details).toHaveTextContent("SourceOak Synthetic Dermatology"),
    );
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
    receiveRecordsAt(RECEIVED_AT);
    showDatesInChicago();
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    await createAllergyIntolerance(
      medplum,
      { text: "Penicillin" },
      "2024-03-12",
      {
        verificationStatus: codeFrom(
          CODE_SYSTEM.ALLERGY_INTOLERANCE_VERIFICATION,
          ALLERGY_INTOLERANCE_VERIFICATION_STATUS.CONFIRMED,
        ),
      },
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
      "PatientHomer SimpsonDateMay 2, 2022VerificationConfirmedReceivedOctober 28, 2026 · 4:10 PM Central TimeAuthorDr. Mira Synthetic",
    );
  });

  it("marks an allergy the clinician ruled out as ruled out, in the list and in its record, though it is still coded active", async () => {
    receiveRecordsAt(RECEIVED_AT);
    showDatesInChicago();
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    await createAllergyIntolerance(
      medplum,
      { text: "Penicillin" },
      "2024-03-12",
    );
    await createAllergyIntolerance(
      medplum,
      { text: "Amoxicillin" },
      "2024-03-13",
      {
        verificationStatus: codeFrom(
          CODE_SYSTEM.ALLERGY_INTOLERANCE_VERIFICATION,
          ALLERGY_INTOLERANCE_VERIFICATION_STATUS.REFUTED,
        ),
      },
    );

    renderHealthRecords(medplum);
    await screen.findByTestId("conditions-empty");
    const panel = await openTab(user, "allergies");

    const rows = await within(panel).findAllByTestId("allergies-record");
    expect(rows.map((row) => row.textContent)).toEqual([
      "AmoxicillinMarch 13, 2024Dr. Mira SyntheticRuled outView record",
      "PenicillinMarch 12, 2024Dr. Mira SyntheticUnconfirmedView record",
    ]);

    await user.click(within(rows[0]).getByTestId("allergies-record-view"));
    const dialog = await screen.findByTestId("health-record-dialog");
    expect(dialog).toHaveTextContent("Ruled out");
    expect(dialog).not.toHaveTextContent("Active");
    expect(
      within(dialog).getByTestId("health-record-details"),
    ).toHaveTextContent(
      "PatientHomer SimpsonDateMarch 13, 2024VerificationRefutedReceivedOctober 28, 2026 · 4:10 PM Central TimeAuthorDr. Mira Synthetic",
    );
  });

  it("tags an active allergy the clinic has not confirmed as unconfirmed, in the list and in its record", async () => {
    receiveRecordsAt(RECEIVED_AT);
    showDatesInChicago();
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    await createAllergyIntolerance(
      medplum,
      { text: "Penicillin" },
      "2024-03-12",
    );

    renderHealthRecords(medplum);
    await screen.findByTestId("conditions-empty");
    const panel = await openTab(user, "allergies");

    const [row] = await within(panel).findAllByTestId("allergies-record");
    expect(row).toHaveTextContent(
      /^PenicillinMarch 12, 2024Dr\. Mira SyntheticUnconfirmedView record$/,
    );
    await user.click(within(row).getByTestId("allergies-record-view"));
    const dialog = await screen.findByTestId("health-record-dialog");
    expect(dialog).toHaveTextContent("PenicillinUnconfirmed");
    expect(dialog).not.toHaveTextContent("PenicillinActive");
    expect(
      within(dialog).getByTestId("health-record-details"),
    ).toHaveTextContent(
      "PatientHomer SimpsonDateMarch 12, 2024VerificationUnconfirmedReceivedOctober 28, 2026 · 4:10 PM Central TimeAuthorDr. Mira Synthetic",
    );
  });

  it("keeps the clinical status in the tag of an unconfirmed allergy that has ended, with Unconfirmed on its Verification line", async () => {
    receiveRecordsAt(RECEIVED_AT);
    showDatesInChicago();
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    await createAllergyIntolerance(medplum, { text: "Latex" }, "2022-05-02", {
      clinicalStatus: codeFrom(
        CODE_SYSTEM.ALLERGY_INTOLERANCE_CLINICAL,
        ALLERGY_INTOLERANCE_CLINICAL_STATUS.RESOLVED,
      ),
    });

    renderHealthRecords(medplum);
    await screen.findByTestId("conditions-empty");
    const panel = await openTab(user, "allergies");

    const [row] = await within(panel).findAllByTestId("allergies-record");
    expect(row).toHaveTextContent(
      /^LatexMay 2, 2022Dr\. Mira SyntheticResolvedView record$/,
    );
    await user.click(within(row).getByTestId("allergies-record-view"));
    const dialog = await screen.findByTestId("health-record-dialog");
    expect(dialog).toHaveTextContent("LatexResolved");
    expect(
      within(dialog).getByTestId("health-record-details"),
    ).toHaveTextContent(
      "PatientHomer SimpsonDateMay 2, 2022VerificationUnconfirmedReceivedOctober 28, 2026 · 4:10 PM Central TimeAuthorDr. Mira Synthetic",
    );
  });

  it.each([
    CONDITION_VERIFICATION_STATUS.UNCONFIRMED,
    CONDITION_VERIFICATION_STATUS.PROVISIONAL,
    CONDITION_VERIFICATION_STATUS.DIFFERENTIAL,
  ])(
    "tags an active condition whose verification is %s as unconfirmed in the list",
    async (verificationCode) => {
      const medplum = new MockClient({ profile: HomerSimpson });
      await createCondition(medplum, "Asthma", "2026-10-19", {
        verificationStatus: codeFrom(
          CODE_SYSTEM.CONDITION_VERIFICATION,
          verificationCode,
        ),
      });

      renderHealthRecords(medplum);

      const [row] = within(
        await screen.findByTestId("conditions-list"),
      ).getAllByTestId("conditions-record");
      expect(row).toHaveTextContent(
        /^AsthmaOctober 19, 2026Dr\. Mira SyntheticUnconfirmedView record$/,
      );
    },
  );

  it("shows the note the clinic wrote on an allergy in its record, under its status", async () => {
    const note =
      "Rash recorded after penicillin. Recorded allergy status remains relevant despite its age. Reaction and verification need clinical review.";

    const dialog = await openConfirmedAllergyRecord([{ text: note }]);

    expect(listNoteTexts(dialog)).toEqual([note]);
    expect(dialog).toHaveTextContent(`Active${note}Patient`);
  });

  it("shows each note the clinic wrote on an allergy, in the order it wrote them", async () => {
    const dialog = await openConfirmedAllergyRecord([
      { text: "Rash recorded after penicillin." },
      { text: "Reaction and verification need clinical review." },
    ]);

    expect(listNoteTexts(dialog)).toEqual([
      "Rash recorded after penicillin.",
      "Reaction and verification need clinical review.",
    ]);
  });

  it("shows nothing in place of a note when the clinic wrote none on an allergy", async () => {
    const dialog = await openConfirmedAllergyRecord(undefined);

    expect(listNoteTexts(dialog)).toEqual([]);
    expect(dialog).toHaveTextContent("ActivePatient");
  });

  it("keeps the line breaks in a note the clinic wrote over several lines", async () => {
    const note = "Reactions:\n- Rash\n- Swelling of the lips";

    const dialog = await openConfirmedAllergyRecord([{ text: note }]);

    const [paragraph] = within(dialog).getAllByTestId("health-record-note");
    expect(paragraph.textContent).toBe(note);
    expect(paragraph).toHaveStyle({ whiteSpace: "pre-line" });
  });

  it("shows under a note, in smaller text, who wrote it and when", async () => {
    showDatesInChicago();
    const note = "Reaction and verification need clinical review.";

    const dialog = await openConfirmedAllergyRecord([
      {
        authorString: "Nurse Ana Synthetic",
        time: "2025-03-12T15:00:00Z",
        text: note,
      },
    ]);

    const writer = within(dialog).getByTestId("health-record-note-writer");
    expect(writer).toHaveTextContent(
      /^By Nurse Ana Synthetic, March 12, 2025$/,
    );
    expect(writer).toHaveAttribute("data-baseweb", "typo-paragraphsmall");
    expect(dialog).toHaveTextContent(
      `${note}By Nurse Ana Synthetic, March 12, 2025Patient`,
    );
  });

  it.each([
    [
      "only who wrote it",
      { authorString: "Nurse Ana Synthetic" },
      "By Nurse Ana Synthetic",
    ],
    [
      "only when it was written",
      { time: "2025-03-12T15:00:00Z" },
      "March 12, 2025",
    ],
  ])(
    "shows under a note that records %s just that",
    async (_, writtenBy, writer) => {
      showDatesInChicago();

      const dialog = await openConfirmedAllergyRecord([
        {
          ...writtenBy,
          text: "Reaction and verification need clinical review.",
        },
      ]);

      expect(
        within(dialog).getByTestId("health-record-note-writer"),
      ).toHaveTextContent(new RegExp(`^${writer}$`));
    },
  );

  it("shows nothing under a note that records neither who wrote it nor when", async () => {
    const dialog = await openConfirmedAllergyRecord([
      { text: "Rash recorded after penicillin." },
    ]);

    expect(
      within(dialog).queryByTestId("health-record-note-writer"),
    ).not.toBeInTheDocument();
  });

  it("marks a condition the clinician ruled out as ruled out, in the list and in its record, though it is still coded active", async () => {
    receiveRecordsAt(RECEIVED_AT);
    showDatesInChicago();
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    await createCondition(medplum, "Eczema", "2026-10-20");
    await createCondition(medplum, "Asthma", "2026-10-21", {
      verificationStatus: codeFrom(
        CODE_SYSTEM.CONDITION_VERIFICATION,
        CONDITION_VERIFICATION_STATUS.REFUTED,
      ),
    });

    renderHealthRecords(medplum);

    const rows = within(
      await screen.findByTestId("conditions-list"),
    ).getAllByTestId("conditions-record");
    expect(rows.map((row) => row.textContent)).toEqual([
      "AsthmaOctober 21, 2026Dr. Mira SyntheticRuled outView record",
      "EczemaOctober 20, 2026Dr. Mira SyntheticActiveView record",
    ]);

    await user.click(within(rows[0]).getByTestId("conditions-record-view"));
    const dialog = await screen.findByTestId("health-record-dialog");
    expect(dialog).toHaveTextContent("Ruled out");
    expect(dialog).not.toHaveTextContent("Active");
    expect(
      within(dialog).getByTestId("health-record-details"),
    ).toHaveTextContent(
      "PatientHomer SimpsonDateOctober 21, 2026VerificationRefutedReceivedOctober 28, 2026 · 4:10 PM Central TimeAuthorDr. Mira Synthetic",
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
    await createProcedure(medplum, "Skin biopsy", "2024-03-12");
    await createProcedure(
      medplum,
      "Mole removal, entered by mistake",
      "2024-03-13",
      { status: PROCEDURE_STATUS.ENTERED_IN_ERROR },
    );
    await createImmunization(medplum, "Influenza vaccine", "2025-10-06");
    await createImmunization(
      medplum,
      "Tetanus vaccine, entered by mistake",
      "2025-10-07",
      { status: IMMUNIZATION_STATUS.ENTERED_IN_ERROR },
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
    const procedures = await openTab(user, "procedures");
    expect(
      listRecordTitles(
        await within(procedures).findByTestId("procedures-list"),
        "procedures",
      ),
    ).toEqual(["Skin biopsy"]);
    const immunizations = await openTab(user, "immunizations");
    expect(
      listRecordTitles(
        await within(immunizations).findByTestId("immunizations-list"),
        "immunizations",
      ),
    ).toEqual(["Influenza vaccine"]);
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
      await within(await openTab(user, "procedures")).findByTestId(
        "procedures-empty",
      ),
    ).toHaveTextContent(
      "No procedures availableNo procedure information has been shared.",
    );
    expect(
      await within(await openTab(user, "immunizations")).findByTestId(
        "immunizations-empty",
      ),
    ).toHaveTextContent(
      "No immunizations availableNo immunization information has been shared.",
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
    const search = vi.spyOn(medplum, "search");

    renderHealthRecords(medplum);
    await screen.findByTestId("conditions-empty");

    expect(
      search.mock.calls
        .filter(([resourceType]) => resourceType === RESOURCE_TYPE.CONDITION)
        .map(([resourceType, query]) => {
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
    receiveRecordsAt(RECEIVED_AT);
    showDatesInChicago();
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
    expect(within(dialog).getByTestId("health-record-value").textContent).toBe(
      "Systolic: 118 mmHg / Diastolic: 76 mmHg",
    );
    expect(
      within(dialog).getByTestId("health-record-details"),
    ).toHaveTextContent(
      "PatientHomer SimpsonDateOctober 20, 2026ReceivedOctober 28, 2026 · 4:10 PM Central TimeAuthorDr. Mira Synthetic",
    );

    await user.click(within(dialog).getByTestId("health-record-close"));
    await waitFor(() =>
      expect(
        screen.queryByTestId("health-record-dialog"),
      ).not.toBeInTheDocument(),
    );
    expect(viewRecord).toHaveFocus();
  });

  it.each([
    [
      "a whole number",
      "Pain score",
      { valueInteger: 4, component: undefined },
      "4",
    ],
    [
      "parts of several kinds",
      "Blood pressure",
      {
        component: [
          {
            code: { text: "Systolic" },
            valueQuantity: { value: 118, unit: "mmHg" },
          },
          { code: { text: "Readings taken" }, valueInteger: 3 },
          { code: { text: "Irregular heartbeat" }, valueBoolean: false },
        ],
      },
      "Systolic: 118 mmHg / Readings taken: 3 / Irregular heartbeat: No",
    ],
  ])(
    "shows the value of a measurement recorded as %s in its record, under the title that names it",
    async (_, name, overrides, value) => {
      const user = userEvent.setup();
      const medplum = new MockClient({ profile: HomerSimpson });
      await createObservation(medplum, OBSERVATION_CATEGORY.VITAL_SIGNS, name, {
        effectiveDateTime: "2026-10-20",
        ...overrides,
      });

      renderHealthRecords(medplum);
      await screen.findByTestId("conditions-empty");
      const panel = await openTab(user, "measurements");
      await user.click(
        await within(panel).findByRole("button", {
          name: `View record: ${name}`,
        }),
      );

      const dialog = await screen.findByTestId("health-record-dialog");
      expect(
        within(dialog).getByTestId("health-record-value").textContent,
      ).toBe(value);
    },
  );

  it("shows no value in the record of a measurement recorded as a ratio with no number on either side", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    await createObservation(
      medplum,
      OBSERVATION_CATEGORY.VITAL_SIGNS,
      "Titer",
      {
        effectiveDateTime: "2026-10-20",
        component: undefined,
        valueRatio: {
          extension: [
            {
              url: "http://example.org/titer-note",
              valueString: "Below detection",
            },
          ],
        },
      },
    );

    renderHealthRecords(medplum);
    await screen.findByTestId("conditions-empty");
    const panel = await openTab(user, "measurements");
    await user.click(
      await within(panel).findByRole("button", { name: "View record: Titer" }),
    );

    const dialog = await screen.findByTestId("health-record-dialog");
    expect(
      within(dialog).queryByTestId("health-record-value"),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).getByTestId("health-record-details"),
    ).toBeInTheDocument();
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

    fireEvent.keyDown(screen.getByTestId("allergies-tab"), {
      key: "ArrowRight",
      keyCode: 39,
    });

    expect(screen.getByTestId("procedures-tab")).toHaveFocus();
    expect(screen.getByTestId("procedures-tab")).toHaveAttribute(
      "aria-selected",
      "true",
    );

    fireEvent.keyDown(screen.getByTestId("procedures-tab"), {
      key: "ArrowRight",
      keyCode: 39,
    });

    expect(screen.getByTestId("immunizations-tab")).toHaveFocus();
    expect(screen.getByTestId("immunizations-tab")).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("reads a kind of record only once its tab is opened", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    const search = vi.spyOn(medplum, "search");
    const listSearchedResourceTypes = () => [
      ...new Set(search.mock.calls.map(([resourceType]) => resourceType)),
    ];

    renderHealthRecords(medplum);
    await screen.findByTestId("conditions-empty");
    expect(listSearchedResourceTypes()).toEqual([
      RESOURCE_TYPE.LIST,
      RESOURCE_TYPE.CONDITION,
    ]);

    await within(await openTab(user, "allergies")).findByTestId(
      "allergies-empty",
    );
    await openTab(user, "conditions");
    expect(listSearchedResourceTypes()).toEqual([
      RESOURCE_TYPE.LIST,
      RESOURCE_TYPE.CONDITION,
      RESOURCE_TYPE.ALLERGY_INTOLERANCE,
    ]);
  });

  it("asks Medplum without its cache, and only with search parameters that each resource type defines", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    const search = vi.spyOn(medplum, "search");

    renderHealthRecords(medplum);
    await screen.findByTestId("conditions-empty");
    await within(await openTab(user, "allergies")).findByTestId(
      "allergies-empty",
    );
    await within(await openTab(user, "procedures")).findByTestId(
      "procedures-empty",
    );
    await within(await openTab(user, "immunizations")).findByTestId(
      "immunizations-empty",
    );
    await within(await openTab(user, "measurements")).findByTestId(
      "measurements-empty",
    );

    expect(
      new Set(search.mock.calls.map(([resourceType]) => resourceType)),
    ).toEqual(
      new Set([
        RESOURCE_TYPE.CONDITION,
        RESOURCE_TYPE.ALLERGY_INTOLERANCE,
        RESOURCE_TYPE.PROCEDURE,
        RESOURCE_TYPE.IMMUNIZATION,
        RESOURCE_TYPE.OBSERVATION,
        RESOURCE_TYPE.LIST,
      ]),
    );
    for (const [resourceType, query, options] of search.mock.calls) {
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

  it("searches each kind of record by the coded element its own resource type names", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    const search = vi.spyOn(medplum, "search");

    renderHealthRecords(medplum, "/health-records?search=influenza");
    await screen.findByTestId("conditions-no-match");
    for (const tabKey of [
      "allergies",
      "procedures",
      "immunizations",
      "measurements",
    ]) {
      await within(await openTab(user, tabKey)).findByTestId(
        `${tabKey}-no-match`,
      );
    }

    const textSearches = search.mock.calls
      .filter(([resourceType]) => resourceType !== RESOURCE_TYPE.LIST)
      .map(([resourceType, query]) => ({
        resourceType,
        textFilters: (
          parseSearchRequest(`${resourceType}${String(query)}`).filters ?? []
        ).filter(({ operator }) => operator === Operator.TEXT),
      }));
    const textSearchParameters: Record<string, string> = {
      [RESOURCE_TYPE.CONDITION]: SEARCH_PARAMETER.CODE,
      [RESOURCE_TYPE.ALLERGY_INTOLERANCE]: SEARCH_PARAMETER.CODE,
      [RESOURCE_TYPE.PROCEDURE]: SEARCH_PARAMETER.CODE,
      [RESOURCE_TYPE.IMMUNIZATION]: SEARCH_PARAMETER.VACCINE_CODE,
      [RESOURCE_TYPE.OBSERVATION]: SEARCH_PARAMETER.CODE,
    };
    expect(
      new Set(textSearches.map(({ resourceType }) => resourceType)),
    ).toEqual(new Set(Object.keys(textSearchParameters)));
    for (const { resourceType, textFilters } of textSearches) {
      expect(
        textFilters.map(({ code, value }) => [code, value]),
        resourceType,
      ).toEqual([[textSearchParameters[resourceType], "influenza"]]);
    }
    for (const { resourceType, textFilters } of textSearches) {
      for (const { code } of textFilters) {
        expect(
          getSearchParameter(resourceType, code),
          `${resourceType} ${code}`,
        ).toBeDefined();
      }
    }
  });

  it("tells a screen reader how many records arrived, without reading the records out", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    await createCondition(medplum, "Eczema", "2026-10-20");

    renderHealthRecords(medplum);

    const status = screen.getByTestId("conditions-status");
    expect(status).toHaveAttribute("role", "status");
    expect(status).toHaveTextContent("Loading…");
    const list = await screen.findByTestId("conditions-list");
    expect(screen.getByTestId("conditions-status")).toBe(status);
    expect(status.textContent).toBe("1 record shown");
    expect(status).not.toContainElement(list);
    expect(list).toBeVisible();
  });

  it("tells a screen reader how many records are shown after the patient asks for more, and keeps the count when the next page cannot be read", async () => {
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
    const status = screen.getByTestId("conditions-status");
    expect(status.textContent).toBe(
      `${constant.SEARCH_PAGE_SIZE} records shown`,
    );
    isRecordReachable = false;
    await user.click(screen.getByTestId("conditions-more"));

    const error = await screen.findByTestId("health-records-error");
    expect(error).toHaveAttribute("role", "alert");
    expect(status.textContent).toBe(
      `${constant.SEARCH_PAGE_SIZE} records shown`,
    );
    isRecordReachable = true;
    await user.click(
      within(screen.getByTestId("health-records-error-retry")).getByRole(
        "button",
      ),
    );

    await waitFor(() =>
      expect(status.textContent).toBe(`${conditionCount} records shown`),
    );
    expect(status).not.toContainElement(list);
  });

  it("tells a screen reader that a tab could not be read, or has nothing in it", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    failSearches(
      medplum,
      (resourceType) => resourceType === RESOURCE_TYPE.CONDITION,
    );

    renderHealthRecords(medplum);

    expect(
      await within(screen.getByTestId("conditions-status")).findByTestId(
        "conditions-unavailable",
      ),
    ).toHaveTextContent("Could not load");
    const panel = await openTab(user, "allergies");
    expect(
      await within(within(panel).getByTestId("allergies-status")).findByTestId(
        "allergies-empty",
      ),
    ).toHaveTextContent("No allergies available");
  });

  it("shows the status with its count already in it when the patient comes back to a tab that was read, so a screen reader hears nothing new", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    await createCondition(medplum, "Eczema", "2026-10-20");

    renderHealthRecords(medplum);
    await screen.findByTestId("conditions-list");
    await within(await openTab(user, "allergies")).findByTestId(
      "allergies-empty",
    );
    const panel = screen.getByTestId("conditions-panel");
    const changes: MutationRecord[] = [];
    const observer = new MutationObserver((records) =>
      changes.push(...records),
    );
    observer.observe(panel, {
      characterData: true,
      childList: true,
      subtree: true,
    });
    await openTab(user, "conditions");
    changes.push(...observer.takeRecords());
    observer.disconnect();

    const status = within(panel).getByTestId("conditions-status");
    expect(status.textContent).toBe("1 record shown");
    expect(changes.filter(({ target }) => status.contains(target))).toEqual([]);
    expect(within(panel).getByTestId("conditions-list")).toBeVisible();
  });

  it("opens the tab named in the address and reads only that tab's records", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    await createAllergyIntolerance(
      medplum,
      { text: "Penicillin" },
      "2026-10-20",
    );
    const search = vi.spyOn(medplum, "search");

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
      new Set(search.mock.calls.map(([resourceType]) => resourceType)),
    ).toEqual(new Set([RESOURCE_TYPE.ALLERGY_INTOLERANCE, RESOURCE_TYPE.LIST]));
  });

  it.each([
    ["names no tab", "/health-records"],
    ["names a tab that does not exist", "/health-records?tab=not-a-tab"],
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

const listClinics = (medplum: MockClient, clinics: Organization[]) =>
  createSourceList(medplum, {
    entry: clinics.map((clinic) => ({ item: createReference(clinic) })),
  });

const readSourceFilter = (searchRequest: SearchRequest) =>
  searchRequest.filters?.find(isSourceFilter)?.value;

const createDeferred = () => {
  let resolve = () => {};
  const promise = new Promise<void>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
};

const createClinics = async (medplum: MockClient) => {
  const oak = await createClinic(medplum, oakDermatology);
  const maple = await createClinic(medplum, mapleDental);
  await listClinics(medplum, [oak, maple]);
  return { maple, oak };
};

const createMoreOakConditionsThanOnePage = async (medplum: MockClient) => {
  const conditionCount = constant.SEARCH_PAGE_SIZE + 1;
  for (let index = 0; index < conditionCount; index += 1) {
    await createCondition(
      medplum,
      `Eczema ${index + 1}`,
      new Date(Date.UTC(2020, 0, 1 + index)).toISOString().slice(0, 10),
      { meta: { source: oakDermatology.address } },
    );
  }
  await createCondition(medplum, "Tooth decay", "2026-10-20", {
    meta: { source: mapleDental.address },
  });
  return conditionCount;
};

const countConditionRequests = (
  medplum: MockClient,
  search: ReturnType<typeof answerAsServer>,
  sourceAddress: string,
) =>
  search.mock.calls.filter(
    ([resourceType, query]) =>
      resourceType === RESOURCE_TYPE.CONDITION &&
      readSourceFilter(
        readSearchRequest(medplum, RESOURCE_TYPE.CONDITION, query as string),
      ) === sourceAddress,
  ).length;

const showEveryOakCondition = async (
  user: ReturnType<typeof userEvent.setup>,
  panel: HTMLElement,
  conditionCount: number,
) => {
  await waitFor(() =>
    expect(within(panel).getAllByTestId("conditions-record")).toHaveLength(
      constant.SEARCH_PAGE_SIZE,
    ),
  );
  await user.click(within(panel).getByTestId("conditions-more"));
  await waitFor(() =>
    expect(within(panel).getAllByTestId("conditions-record")).toHaveLength(
      conditionCount,
    ),
  );
};

describe("Health records, narrowed to a source or a search", () => {
  it("lists every named source on the patient's list after All sources, in the order of her list", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    const oak = await createClinic(medplum, oakDermatology);
    const maple = await createClinic(medplum, mapleDental);
    const unnamedClinic = await createClinic(medplum, cedarCardiology, {
      name: undefined,
    });
    const clinicWithNoAddress = await createClinic(medplum, pineFamilyClinic, {
      identifier: [],
    });
    await listClinics(medplum, [
      maple,
      oak,
      unnamedClinic,
      clinicWithNoAddress,
    ]);
    answerAsServer(medplum);

    renderHealthRecords(medplum);
    await screen.findByTestId("conditions-empty");
    await user.click(getSourceMenu());

    await waitFor(() =>
      expect(listSourceOptionNames()).toEqual([
        ALL_SOURCES,
        mapleDental.name,
        oakDermatology.name,
      ]),
    );
  });

  it("narrows every tab to the chosen source at each of its addresses, keeps it in the address beside the tab without a history entry, and lists every record again for All sources", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    const oakAddresses = [
      oakDermatology.address,
      `${oakDermatology.address}/v2`,
    ];
    const oak = await createClinic(medplum, oakDermatology, {
      identifier: oakAddresses.map((value) => ({
        system: IDENTIFIER_SYSTEM.URI,
        value,
      })),
    });
    const maple = await createClinic(medplum, mapleDental);
    await listClinics(medplum, [oak, maple]);
    await createCondition(medplum, "Eczema", "2026-10-20", {
      meta: { source: oakAddresses[0] },
    });
    await createCondition(medplum, "Rosacea", "2026-09-01", {
      meta: { source: oakAddresses[1] },
    });
    await createCondition(medplum, "Tooth decay", "2025-04-08", {
      meta: { source: mapleDental.address },
    });
    await createAllergyIntolerance(
      medplum,
      { text: "Penicillin" },
      "2024-03-12",
      {
        meta: { source: oakDermatology.address },
      },
    );
    await createAllergyIntolerance(medplum, { text: "Latex" }, "2025-04-08", {
      meta: { source: mapleDental.address },
    });
    const search = answerAsServer(medplum);
    const { router } = renderHealthRecords(medplum);
    const conditions = screen.getByTestId("conditions-panel");
    await within(conditions).findByTestId("conditions-list");

    await chooseRecordSource(user, oakDermatology.name);

    await waitFor(() =>
      expect(listRecordTitles(conditions, "conditions")).toEqual([
        "Eczema",
        "Rosacea",
      ]),
    );
    expect(router.state.location.search).toBe(`?source=${oak.id}`);
    expect(router.state.historyAction).toBe("REPLACE");
    expect(
      listFilterValues(
        medplum,
        search,
        RESOURCE_TYPE.CONDITION,
        isSourceFilter,
      ).at(-1),
    ).toBe(oakAddresses.join(SEARCH_VALUE_SEPARATOR));
    expect(
      getSearchParameter(RESOURCE_TYPE.CONDITION, SEARCH_PARAMETER.SOURCE),
    ).toBeDefined();
    const allergies = await openTab(user, "allergies");
    await waitFor(() =>
      expect(listRecordTitles(allergies, "allergies")).toEqual(["Penicillin"]),
    );
    expect(router.state.location.search).toBe(
      `?source=${oak.id}&tab=allergies`,
    );

    await chooseRecordSource(user, ALL_SOURCES);

    await waitFor(() =>
      expect(listRecordTitles(allergies, "allergies")).toEqual([
        "Latex",
        "Penicillin",
      ]),
    );
    expect(router.state.location.search).toBe("?tab=allergies");
    expect(getSourceMenu()).toHaveAccessibleName(
      `Selected ${ALL_SOURCES}. Source`,
    );
  });

  it("chooses a source with the keyboard alone", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    const { oak } = await createClinics(medplum);
    await createCondition(medplum, "Eczema", "2026-10-20", {
      meta: { source: oakDermatology.address },
    });
    await createCondition(medplum, "Tooth decay", "2025-04-08", {
      meta: { source: mapleDental.address },
    });
    answerAsServer(medplum);
    const { router } = renderHealthRecords(medplum);
    const conditions = screen.getByTestId("conditions-panel");
    await within(conditions).findByTestId("conditions-list");
    await waitFor(() =>
      expect(listRecordTexts(conditions, "conditions")[0]).toContain(
        oakDermatology.name,
      ),
    );

    chooseNextRecordSourceByKeyboard(2);

    await waitFor(() =>
      expect(router.state.location.search).toBe(`?source=${oak.id}`),
    );
    await waitFor(() =>
      expect(listRecordTitles(conditions, "conditions")).toEqual(["Eczema"]),
    );
    expect(getSourceMenu()).toHaveFocus();
  });

  it("opens with the source and search named in the address, and asks for no records until the patient's sources say which addresses the source has", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    const { oak } = await createClinics(medplum);
    await createAllergyIntolerance(
      medplum,
      { text: "Penicillin" },
      "2024-03-12",
      {
        meta: { source: oakDermatology.address },
      },
    );
    await createAllergyIntolerance(medplum, { text: "Peanut" }, "2024-05-01", {
      meta: { source: oakDermatology.address },
    });
    await createAllergyIntolerance(
      medplum,
      { text: "Penicillin" },
      "2025-04-08",
      {
        meta: { source: mapleDental.address },
      },
    );
    const sourcesArrive = createDeferred();
    const search = answerAsServer(medplum, async (resourceType) => {
      if (resourceType === RESOURCE_TYPE.LIST) {
        await sourcesArrive.promise;
      }
    });

    renderHealthRecords(
      medplum,
      `/health-records?tab=allergies&source=${oak.id}&search=penic`,
    );

    const panel = screen.getByTestId("allergies-panel");
    expect(within(panel).getByTestId("allergies-loading")).toBeInTheDocument();
    await waitFor(() =>
      expect(search).toHaveBeenCalledWith(
        RESOURCE_TYPE.LIST,
        expect.anything(),
        expect.anything(),
      ),
    );
    expect(
      search.mock.calls.filter(
        ([resourceType]) => resourceType === RESOURCE_TYPE.ALLERGY_INTOLERANCE,
      ),
    ).toEqual([]);
    expect(getSearchBox()).toHaveValue("penic");
    expect(getSourceMenu()).toHaveAccessibleName("Loading sources. Source");
    sourcesArrive.resolve();

    await waitFor(() =>
      expect(listRecordTitles(panel, "allergies")).toEqual(["Penicillin"]),
    );
    expect(listRecordTexts(panel, "allergies")[0]).toContain(
      oakDermatology.name,
    );
    expect(
      new Set(
        listFilterValues(
          medplum,
          search,
          RESOURCE_TYPE.ALLERGY_INTOLERANCE,
          isSourceFilter,
        ),
      ),
    ).toEqual(new Set([oakDermatology.address]));
    expect(
      new Set(
        listFilterValues(
          medplum,
          search,
          RESOURCE_TYPE.ALLERGY_INTOLERANCE,
          isTextFilter,
        ),
      ),
    ).toEqual(new Set(["penic"]));
    expect(getSourceMenu()).toHaveAccessibleName(
      `Selected ${oakDermatology.name}. Source`,
    );
  });

  it("lists every record under All sources when the address names a source that is not on the patient's list", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    await createClinics(medplum);
    await createCondition(medplum, "Eczema", "2026-10-20", {
      meta: { source: oakDermatology.address },
    });
    await createCondition(medplum, "Tooth decay", "2025-04-08", {
      meta: { source: mapleDental.address },
    });
    const search = answerAsServer(medplum);

    renderHealthRecords(medplum, "/health-records?source=unknown-clinic");

    const conditions = screen.getByTestId("conditions-panel");
    await within(conditions).findByTestId("conditions-list");
    expect(listRecordTitles(conditions, "conditions")).toEqual([
      "Eczema",
      "Tooth decay",
    ]);
    expect(getSourceMenu()).toHaveAccessibleName(
      `Selected ${ALL_SOURCES}. Source`,
    );
    expect(
      listFilterValues(
        medplum,
        search,
        RESOURCE_TYPE.CONDITION,
        isSourceFilter,
      ),
    ).not.toContain(expect.any(String));
  });

  it("says the records could not be read when a source is chosen and the patient's sources cannot be read, and lists that source's records once the patient tries again", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    const { oak } = await createClinics(medplum);
    await createCondition(medplum, "Eczema", "2026-10-20", {
      meta: { source: oakDermatology.address },
    });
    await createCondition(medplum, "Tooth decay", "2025-04-08", {
      meta: { source: mapleDental.address },
    });
    let areSourcesReachable = false;
    const search = answerAsServer(medplum, async (resourceType) => {
      if (resourceType === RESOURCE_TYPE.LIST && !areSourcesReachable) {
        throw networkFailure();
      }
    });

    renderHealthRecords(medplum, `/health-records?source=${oak.id}`);

    const panel = screen.getByTestId("conditions-panel");
    expect(
      await within(panel).findByTestId("conditions-unavailable"),
    ).toHaveTextContent("Could not load");
    expect(screen.getByTestId("health-records-error")).toHaveTextContent(
      constant.DEFAULT_ERROR_MESSAGE,
    );
    expect(getSourceMenu()).toHaveAccessibleName(
      "Could not load sources. Source",
    );
    expect(
      within(panel).getByTestId("conditions-clear-filters"),
    ).toBeInTheDocument();
    expect(
      search.mock.calls.filter(
        ([resourceType]) => resourceType === RESOURCE_TYPE.CONDITION,
      ),
    ).toEqual([]);
    areSourcesReachable = true;
    await user.click(
      within(screen.getByTestId("health-records-error-retry")).getByRole(
        "button",
      ),
    );

    await waitFor(() =>
      expect(listRecordTitles(panel, "conditions")).toEqual(["Eczema"]),
    );
    expect(
      screen.queryByTestId("health-records-error"),
    ).not.toBeInTheDocument();
  });

  it("lists every record when the patient clears a source that could not be looked up because her sources cannot be read", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    const { oak } = await createClinics(medplum);
    await createCondition(medplum, "Eczema", "2026-10-20", {
      meta: { source: oakDermatology.address },
    });
    await createCondition(medplum, "Tooth decay", "2025-04-08", {
      meta: { source: mapleDental.address },
    });
    answerAsServer(medplum, async (resourceType) => {
      if (resourceType === RESOURCE_TYPE.LIST) {
        throw networkFailure();
      }
    });
    const { router } = renderHealthRecords(
      medplum,
      `/health-records?source=${oak.id}`,
    );
    const panel = screen.getByTestId("conditions-panel");
    await within(panel).findByTestId("conditions-unavailable");

    await user.click(within(panel).getByTestId("conditions-clear-filters"));

    await waitFor(() =>
      expect(listRecordTitles(panel, "conditions")).toEqual([
        "Eczema",
        "Tooth decay",
      ]),
    );
    expect(router.state.location.search).toBe("");
    expect(getSourceMenu()).toHaveAccessibleName(
      `Selected ${ALL_SOURCES}. Source`,
    );
    expect(getSearchBox()).toHaveFocus();
  });

  it("finds a record by any part of its name or of a coding's display, ignoring case, asking once when the patient stops typing, and tells a screen reader how many it found", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    await createAllergyIntolerance(
      medplum,
      {
        coding: [{ code: "91935009", display: "Allergy to peanut" }],
      },
      "2025-04-08",
    );
    await createAllergyIntolerance(
      medplum,
      { text: "Penicillin" },
      "2024-03-12",
    );
    const search = answerAsServer(medplum);
    const { router } = renderHealthRecords(
      medplum,
      "/health-records?tab=allergies",
    );
    const panel = screen.getByTestId("allergies-panel");
    await within(panel).findByTestId("allergies-list");

    await searchRecords(user, "PEANUT");

    await waitFor(() =>
      expect(listRecordTitles(panel, "allergies")).toEqual([
        "Allergy to peanut",
      ]),
    );
    expect(within(panel).getByTestId("allergies-status")).toHaveTextContent(
      "1 record shown",
    );
    expect(router.state.location.search).toBe("?tab=allergies&search=PEANUT");
    expect(
      listFilterValues(
        medplum,
        search,
        RESOURCE_TYPE.ALLERGY_INTOLERANCE,
        isTextFilter,
      ).filter((value) => value !== undefined),
    ).toEqual(["PEANUT", "PEANUT"]);
  });

  it("searches for a name with a comma in it as one name, and leaves out the spaces around it", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    await createCondition(medplum, "Eczema, atopic", "2026-10-20");
    await createCondition(medplum, "Atopy", "2026-09-01");
    const search = answerAsServer(medplum);
    renderHealthRecords(medplum);
    const conditions = screen.getByTestId("conditions-panel");
    await within(conditions).findByTestId("conditions-list");

    await searchRecords(user, "  eczema, atopic ");

    await waitFor(() =>
      expect(listRecordTitles(conditions, "conditions")).toEqual([
        "Eczema, atopic",
      ]),
    );
    expect(
      listFilterValues(
        medplum,
        search,
        RESOURCE_TYPE.CONDITION,
        isTextFilter,
      ).at(-1),
    ).toBe(escapeSearchValue("eczema, atopic"));
  });

  it("says when nothing matches, and clears the source and the search on request, listing every record with focus back in the search box", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    const { oak } = await createClinics(medplum);
    await createCondition(medplum, "Eczema", "2026-10-20", {
      meta: { source: oakDermatology.address },
    });
    await createCondition(medplum, "Tooth decay", "2025-04-08", {
      meta: { source: mapleDental.address },
    });
    answerAsServer(medplum);
    const { router } = renderHealthRecords(
      medplum,
      `/health-records?source=${oak.id}&search=decay`,
    );
    const panel = screen.getByTestId("conditions-panel");

    const notice = await within(panel).findByTestId("conditions-no-match");
    expect(notice).toHaveTextContent(
      "No records availableNo matching records are available. This does not establish that you have no relevant history.",
    );
    expect(
      within(within(panel).getByTestId("conditions-status")).queryByRole(
        "button",
      ),
    ).not.toBeInTheDocument();
    await user.click(within(panel).getByTestId("conditions-clear-filters"));

    await waitFor(() =>
      expect(listRecordTitles(panel, "conditions")).toEqual([
        "Eczema",
        "Tooth decay",
      ]),
    );
    expect(router.state.location.search).toBe("");
    expect(getSearchBox()).toHaveValue("");
    expect(getSearchBox()).toHaveFocus();
    expect(getSourceMenu()).toHaveAccessibleName(
      `Selected ${ALL_SOURCES}. Source`,
    );
  });

  it("says a kind of record has nothing in it, with no way to clear, when no source or search is chosen", async () => {
    renderHealthRecords(new MockClient({ profile: HomerSimpson }));

    expect(await screen.findByTestId("conditions-empty")).toBeInTheDocument();
    expect(
      screen.queryByTestId("conditions-clear-filters"),
    ).not.toBeInTheDocument();
  });

  it("keeps the chosen source and search when the patient asks for more", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    const { oak } = await createClinics(medplum);
    const conditionCount = constant.SEARCH_PAGE_SIZE + 1;
    for (let index = 0; index < conditionCount; index += 1) {
      await createCondition(
        medplum,
        `Eczema ${index + 1}`,
        new Date(Date.UTC(2020, 0, 1 + index)).toISOString().slice(0, 10),
        { meta: { source: oakDermatology.address } },
      );
    }
    await createCondition(medplum, "Eczema at the dentist", "2026-10-20", {
      meta: { source: mapleDental.address },
    });
    const search = answerAsServer(medplum);
    renderHealthRecords(medplum, `/health-records?source=${oak.id}&search=ecz`);
    const panel = screen.getByTestId("conditions-panel");
    await waitFor(() =>
      expect(within(panel).getAllByTestId("conditions-record")).toHaveLength(
        constant.SEARCH_PAGE_SIZE,
      ),
    );

    await user.click(within(panel).getByTestId("conditions-more"));

    await waitFor(() =>
      expect(within(panel).getAllByTestId("conditions-record")).toHaveLength(
        conditionCount,
      ),
    );
    expect(listRecordTitles(panel, "conditions")).not.toContain(
      "Eczema at the dentist",
    );
    const nextPageRequest = readSearchRequest(
      medplum,
      RESOURCE_TYPE.CONDITION,
      search.mock.calls.filter(
        ([resourceType]) => resourceType === RESOURCE_TYPE.CONDITION,
      )[1][1] as string,
    );
    expect(nextPageRequest.offset).toBe(constant.SEARCH_PAGE_SIZE);
    expect(nextPageRequest.filters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: SEARCH_PARAMETER.SOURCE,
          value: oakDermatology.address,
        }),
        expect.objectContaining({
          code: SEARCH_PARAMETER.CODE,
          operator: Operator.TEXT,
          value: "ecz",
        }),
      ]),
    );
  });

  it("keeps every record already shown for a source when the patient comes back to it before the other source's answer arrives, and drops that answer", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    const { oak } = await createClinics(medplum);
    const conditionCount = await createMoreOakConditionsThanOnePage(medplum);
    let isMapleHeld = false;
    const mapleAnswer = createDeferred();
    const search = answerAsServer(
      medplum,
      async (resourceType, searchRequest) => {
        if (
          resourceType === RESOURCE_TYPE.CONDITION &&
          isMapleHeld &&
          readSourceFilter(searchRequest) === mapleDental.address
        ) {
          await mapleAnswer.promise;
        }
      },
    );
    renderHealthRecords(medplum, `/health-records?source=${oak.id}`);
    const panel = screen.getByTestId("conditions-panel");
    await showEveryOakCondition(user, panel, conditionCount);
    isMapleHeld = true;
    const oakRequestCount = countConditionRequests(
      medplum,
      search,
      oakDermatology.address,
    );

    await chooseRecordSource(user, mapleDental.name);
    await within(panel).findByTestId("conditions-loading");
    await chooseRecordSource(user, oakDermatology.name);

    expect(within(panel).getAllByTestId("conditions-record")).toHaveLength(
      conditionCount,
    );
    await act(async () => {
      mapleAnswer.resolve();
      await mapleAnswer.promise;
    });
    expect(within(panel).getAllByTestId("conditions-record")).toHaveLength(
      conditionCount,
    );
    expect(
      countConditionRequests(medplum, search, oakDermatology.address),
    ).toBe(oakRequestCount);
  });

  it("keeps every record already shown for a source when the patient comes back to it after the other source failed, and shows no failure", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    const { oak } = await createClinics(medplum);
    const conditionCount = await createMoreOakConditionsThanOnePage(medplum);
    const search = answerAsServer(
      medplum,
      async (resourceType, searchRequest) => {
        if (
          resourceType === RESOURCE_TYPE.CONDITION &&
          readSourceFilter(searchRequest) === mapleDental.address
        ) {
          throw networkFailure();
        }
      },
    );
    renderHealthRecords(medplum, `/health-records?source=${oak.id}`);
    const panel = screen.getByTestId("conditions-panel");
    await showEveryOakCondition(user, panel, conditionCount);
    const oakRequestCount = countConditionRequests(
      medplum,
      search,
      oakDermatology.address,
    );
    await chooseRecordSource(user, mapleDental.name);
    await within(panel).findByTestId("conditions-unavailable");

    await chooseRecordSource(user, oakDermatology.name);

    await waitFor(() =>
      expect(
        screen.queryByTestId("health-records-error"),
      ).not.toBeInTheDocument(),
    );
    expect(within(panel).getAllByTestId("conditions-record")).toHaveLength(
      conditionCount,
    );
    expect(
      countConditionRequests(medplum, search, oakDermatology.address),
    ).toBe(oakRequestCount);
  });

  it("never shows the records of the source chosen before while the next source's records load, nor an answer that arrives after the patient chose again", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    await createClinics(medplum);
    await createCondition(medplum, "Eczema", "2026-10-20", {
      meta: { source: oakDermatology.address },
    });
    await createCondition(medplum, "Tooth decay", "2025-04-08", {
      meta: { source: mapleDental.address },
    });
    let heldSource: string | null = null;
    const heldAnswer = createDeferred();
    answerAsServer(medplum, async (resourceType, searchRequest) => {
      if (
        resourceType === RESOURCE_TYPE.CONDITION &&
        heldSource !== null &&
        readSourceFilter(searchRequest) === heldSource
      ) {
        await heldAnswer.promise;
      }
    });
    renderHealthRecords(medplum);
    const panel = screen.getByTestId("conditions-panel");
    await within(panel).findByTestId("conditions-list");
    await chooseRecordSource(user, oakDermatology.name);
    await waitFor(() =>
      expect(listRecordTitles(panel, "conditions")).toEqual(["Eczema"]),
    );
    heldSource = mapleDental.address;

    await chooseRecordSource(user, mapleDental.name);

    expect(
      await within(panel).findByTestId("conditions-loading"),
    ).toBeInTheDocument();
    expect(
      within(panel).queryByTestId("conditions-record"),
    ).not.toBeInTheDocument();
    heldSource = null;
    await chooseRecordSource(user, oakDermatology.name);
    await waitFor(() =>
      expect(listRecordTitles(panel, "conditions")).toEqual(["Eczema"]),
    );
    await act(async () => {
      heldAnswer.resolve();
      await heldAnswer.promise;
    });
    expect(listRecordTitles(panel, "conditions")).toEqual(["Eczema"]);
  });

  it("never shows a failure from the source chosen before once the patient chooses another source, in the banner or in the tab that failed", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    const { oak } = await createClinics(medplum);
    await createCondition(medplum, "Tooth decay", "2025-04-08", {
      meta: { source: mapleDental.address },
    });
    await createAllergyIntolerance(medplum, { text: "Latex" }, "2025-04-08", {
      meta: { source: mapleDental.address },
    });
    answerAsServer(medplum, async (resourceType, searchRequest) => {
      if (
        resourceType === RESOURCE_TYPE.CONDITION &&
        readSourceFilter(searchRequest) === oakDermatology.address
      ) {
        throw networkFailure();
      }
    });
    renderHealthRecords(medplum, `/health-records?source=${oak.id}`);
    const conditions = screen.getByTestId("conditions-panel");
    await within(conditions).findByTestId("conditions-unavailable");
    const allergies = await openTab(user, "allergies");
    await within(allergies).findByTestId("allergies-no-match");
    expect(screen.getByTestId("health-records-error")).toBeInTheDocument();

    await chooseRecordSource(user, mapleDental.name);

    await waitFor(() =>
      expect(listRecordTitles(allergies, "allergies")).toEqual(["Latex"]),
    );
    expect(
      screen.queryByTestId("health-records-error"),
    ).not.toBeInTheDocument();
    const shownStatuses: string[] = [];
    const observer = new MutationObserver(() =>
      shownStatuses.push(
        within(conditions).queryByTestId("conditions-status")?.textContent ??
          "",
      ),
    );
    observer.observe(conditions, {
      characterData: true,
      childList: true,
      subtree: true,
    });
    await openTab(user, "conditions");
    await waitFor(() =>
      expect(listRecordTitles(conditions, "conditions")).toEqual([
        "Tooth decay",
      ]),
    );
    observer.disconnect();
    expect(shownStatuses).not.toContain("Could not load");
  });

  it("asks again for a tab opened after the source changed, and shows the answer it already has when the patient comes back to a source", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    await createClinics(medplum);
    await createAllergyIntolerance(
      medplum,
      { text: "Penicillin" },
      "2024-03-12",
      {
        meta: { source: oakDermatology.address },
      },
    );
    await createAllergyIntolerance(medplum, { text: "Latex" }, "2025-04-08", {
      meta: { source: mapleDental.address },
    });
    const search = answerAsServer(medplum);
    renderHealthRecords(medplum);
    const allergies = await openTab(user, "allergies");
    await within(allergies).findByTestId("allergies-list");
    await openTab(user, "conditions");

    await chooseRecordSource(user, mapleDental.name);
    await screen.findByTestId("conditions-no-match");
    await openTab(user, "allergies");

    await waitFor(() =>
      expect(listRecordTitles(allergies, "allergies")).toEqual(["Latex"]),
    );
    expect(
      listFilterValues(
        medplum,
        search,
        RESOURCE_TYPE.ALLERGY_INTOLERANCE,
        isSourceFilter,
      ).at(-1),
    ).toBe(mapleDental.address);
  });

  it("keeps showing a record opened while a search was being typed once the saved search leaves it out of the list", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    await createCondition(medplum, "Eczema", "2026-10-20");
    await createCondition(medplum, "Tooth decay", "2025-04-08");
    answerAsServer(medplum);
    const { router } = renderHealthRecords(medplum);
    const conditions = screen.getByTestId("conditions-panel");
    await within(conditions).findByTestId("conditions-list");
    const [, toothDecay] =
      within(conditions).getAllByTestId("conditions-record");

    await searchRecords(user, "ecz");
    await user.click(within(toothDecay).getByTestId("conditions-record-view"));

    await waitFor(() =>
      expect(router.state.location.search).toBe("?search=ecz"),
    );
    await waitFor(() =>
      expect(listRecordTitles(conditions, "conditions")).toEqual(["Eczema"]),
    );
    const dialog = screen.getByTestId("health-record-dialog");
    expect(dialog).toHaveAccessibleName("Tooth decay");
    expect(
      within(dialog).getByTestId("health-record-details"),
    ).toBeInTheDocument();
  });

  it("puts the box back to the address when a link to the page or the back button changes it, and writes nothing back into the address", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    await createCondition(medplum, "Eczema", "2026-10-20");
    await createCondition(medplum, "Tooth decay", "2025-04-08");
    answerAsServer(medplum);
    const { router } = renderHealthRecords(medplum);
    const conditions = screen.getByTestId("conditions-panel");
    await within(conditions).findByTestId("conditions-list");
    await searchRecords(user, "ecz");
    await waitFor(() =>
      expect(router.state.location.search).toBe("?search=ecz"),
    );
    const waitLongerThanTyping = () =>
      act(
        () =>
          new Promise((settle) =>
            setTimeout(settle, constant.SEARCH_INPUT_DELAY_MILLISECONDS * 2),
          ),
      );

    await act(() => router.navigate(routes.HEALTH_RECORDS));

    expect(getSearchBox()).toHaveValue("");
    await waitLongerThanTyping();
    expect(router.state.location.search).toBe("");

    await act(() => router.navigate(-1));

    expect(getSearchBox()).toHaveValue("ecz");
    await waitLongerThanTyping();
    expect(router.state.location.search).toBe("?search=ecz");
    await waitFor(() =>
      expect(listRecordTitles(conditions, "conditions")).toEqual(["Eczema"]),
    );
  });
});

describe("Health records, procedures", () => {
  const performedForOak = {
    actor: doctor,
    onBehalfOf: { display: oakDermatology.name },
  };

  it("lists the patient's procedures newest first, with the clinic, the day, who performed each and its status", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    await createRecordSources(medplum, [oakDermatology]);
    includeListedOrganizations(medplum);
    await createProcedure(medplum, "Skin biopsy", "2024-03-12", {
      meta: { source: oakDermatology.address },
      performer: [performedForOak],
    });
    await createProcedure(medplum, "Mole removal", "2025-02-03", {
      meta: { source: oakDermatology.address },
      performer: [performedForOak],
    });

    renderHealthRecords(medplum);
    await screen.findByTestId("conditions-empty");
    const panel = await openTab(user, "procedures");

    await waitFor(() =>
      expect(listRecordTexts(panel, "procedures")).toEqual([
        "Mole removalOak Synthetic Dermatology · February 3, 2025Dr. Mira SyntheticCompletedView record",
        "Skin biopsyOak Synthetic Dermatology · March 12, 2024Dr. Mira SyntheticCompletedView record",
      ]),
    );
  });

  it("names the clinic once when the clinic itself is recorded as performing the procedure", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    await createRecordSources(medplum, [oakDermatology]);
    includeListedOrganizations(medplum);
    await createProcedure(medplum, "Skin biopsy", "2024-03-12", {
      meta: { source: oakDermatology.address },
      performer: [{ actor: { display: oakDermatology.name } }],
    });

    renderHealthRecords(medplum, "/health-records?tab=procedures");
    const panel = screen.getByTestId("procedures-panel");

    await waitFor(() =>
      expect(listRecordTexts(panel, "procedures")).toEqual([
        "Skin biopsyOak Synthetic Dermatology · March 12, 2024CompletedView record",
      ]),
    );
  });

  it("asks Medplum for the patient's own procedures, newest first, leaving out those entered in error", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    const search = vi.spyOn(medplum, "search");

    renderHealthRecords(medplum, "/health-records?tab=procedures");
    await within(screen.getByTestId("procedures-panel")).findByTestId(
      "procedures-empty",
    );

    const [resourceType, query] =
      search.mock.calls.find(
        ([searchedResourceType]) =>
          searchedResourceType === RESOURCE_TYPE.PROCEDURE,
      ) ?? [];
    const { filters, sortRules } = parseSearchRequest(
      `${resourceType}${String(query)}`,
    );
    expect(filters).toEqual(
      expect.arrayContaining([
        {
          code: SEARCH_PARAMETER.PATIENT,
          operator: Operator.EQUALS,
          value: getReferenceString(HomerSimpson),
        },
        {
          code: SEARCH_PARAMETER.STATUS,
          operator: Operator.NOT,
          value: PROCEDURE_STATUS.ENTERED_IN_ERROR,
        },
      ]),
    );
    expect(sortRules).toEqual([
      { code: SEARCH_PARAMETER.DATE, descending: true },
    ]);
  });

  it("names every clinician who performed a procedure, each once", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    await createProcedure(medplum, "Skin graft", "2024-03-12", {
      performer: [
        { function: { text: "Surgeon" }, actor: doctor },
        { actor: { display: "Nurse Ana Synthetic" } },
        { function: { text: "Attending" }, actor: doctor },
      ],
    });

    renderHealthRecords(medplum);
    await screen.findByTestId("conditions-empty");
    const panel = await openTab(user, "procedures");

    expect(
      await within(panel).findByTestId("procedures-record"),
    ).toHaveTextContent(
      "Skin graftMarch 12, 2024Dr. Mira Synthetic, Nurse Ana SyntheticCompletedView record",
    );
  });

  it("tags a procedure recorded as not done as not done, in the list and in its record, never as completed", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    await createProcedure(medplum, "Skin biopsy", undefined, {
      status: PROCEDURE_STATUS.NOT_DONE,
    });

    renderHealthRecords(medplum);
    await screen.findByTestId("conditions-empty");
    const panel = await openTab(user, "procedures");
    const row = await within(panel).findByTestId("procedures-record");
    expect(row).toHaveTextContent(
      "Skin biopsyDr. Mira SyntheticNot doneView record",
    );
    await user.click(
      within(row).getByRole("button", { name: "View record: Skin biopsy" }),
    );

    const dialog = await screen.findByTestId("health-record-dialog");
    expect(within(dialog).getByTestId("health-record-status").textContent).toBe(
      "Not done",
    );
    expect(dialog).not.toHaveTextContent("Completed");
  });

  it("dates a procedure performed over a period by the day it started", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    await createProcedure(medplum, "Patch testing", undefined, {
      performedPeriod: { start: "2024-03-12", end: "2024-03-14" },
    });

    renderHealthRecords(medplum);
    await screen.findByTestId("conditions-empty");
    const panel = await openTab(user, "procedures");

    expect(
      await within(panel).findByTestId("procedures-record"),
    ).toHaveTextContent(
      "Patch testingMarch 12, 2024Dr. Mira SyntheticCompletedView record",
    );
  });

  it("dates a procedure whose date is written as text when the text is a date", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    await createProcedure(medplum, "Childhood tonsillectomy", undefined, {
      performedString: "2019-05",
    });

    renderHealthRecords(medplum);
    await screen.findByTestId("conditions-empty");
    const panel = await openTab(user, "procedures");

    expect(
      await within(panel).findByTestId("procedures-record"),
    ).toHaveTextContent(
      "Childhood tonsillectomyMay 2019Dr. Mira SyntheticCompletedView record",
    );
  });

  it("lists procedures with no date after the dated ones", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    await createProcedure(medplum, "Skin biopsy", "2024-03-12");
    await createProcedure(medplum, "Childhood tonsillectomy", undefined);
    await createProcedure(medplum, "Mole removal", "2025-02-03");

    renderHealthRecords(medplum);
    await screen.findByTestId("conditions-empty");
    const panel = await openTab(user, "procedures");

    expect(
      listRecordTitles(
        await within(panel).findByTestId("procedures-list"),
        "procedures",
      ),
    ).toEqual(["Mole removal", "Skin biopsy", "Childhood tonsillectomy"]);
  });

  it("shows only the signed-in patient's procedures", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    const otherPatient = await medplum.createResource<Patient>({
      resourceType: RESOURCE_TYPE.PATIENT,
      name: [{ given: ["Harper"], family: "Synthetic" }],
    });
    await createProcedure(medplum, "Another patient's biopsy", "2024-03-13", {
      subject: createReference(otherPatient),
    });
    await createProcedure(medplum, "Skin biopsy", "2024-03-12");

    renderHealthRecords(medplum);
    await screen.findByTestId("conditions-empty");
    const panel = await openTab(user, "procedures");

    expect(
      listRecordTitles(
        await within(panel).findByTestId("procedures-list"),
        "procedures",
      ),
    ).toEqual(["Skin biopsy"]);
  });

  it("opens a procedure in a dialog with its status, the clinic, the day and who performed it", async () => {
    receiveRecordsAt(RECEIVED_AT);
    showDatesInChicago();
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    await createRecordSources(medplum, [oakDermatology]);
    includeListedOrganizations(medplum);
    await createProcedure(medplum, "Skin biopsy", "2024-03-12", {
      meta: { source: oakDermatology.address },
      performer: [performedForOak],
    });

    renderHealthRecords(medplum, "/health-records?tab=procedures");
    const panel = screen.getByTestId("procedures-panel");
    await waitFor(() =>
      expect(within(panel).getByTestId("procedures-record")).toHaveTextContent(
        oakDermatology.name,
      ),
    );
    await user.click(
      within(panel).getByRole("button", { name: "View record: Skin biopsy" }),
    );

    const dialog = await screen.findByTestId("health-record-dialog");
    expect(dialog).toHaveAccessibleName("Skin biopsy");
    expect(within(dialog).getByTestId("health-record-status").textContent).toBe(
      "Completed",
    );
    expect(
      within(dialog).getByTestId("health-record-details"),
    ).toHaveTextContent(
      "PatientHomer SimpsonSourceOak Synthetic DermatologyDateMarch 12, 2024ReceivedOctober 28, 2026 · 4:10 PM Central TimeAuthorDr. Mira Synthetic",
    );
  });

  it("lists only the chosen source's procedures", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    const oak = await createClinic(medplum, oakDermatology);
    const maple = await createClinic(medplum, mapleDental);
    await listClinics(medplum, [oak, maple]);
    await createProcedure(medplum, "Skin biopsy", "2024-03-12", {
      meta: { source: oakDermatology.address },
    });
    await createProcedure(medplum, "Tooth extraction", "2025-04-08", {
      meta: { source: mapleDental.address },
    });
    answerAsServer(medplum);
    renderHealthRecords(medplum, "/health-records?tab=procedures");
    const panel = screen.getByTestId("procedures-panel");
    await within(panel).findByTestId("procedures-list");

    await chooseRecordSource(user, oakDermatology.name);

    await waitFor(() =>
      expect(listRecordTitles(panel, "procedures")).toEqual(["Skin biopsy"]),
    );

    await chooseRecordSource(user, mapleDental.name);

    await waitFor(() =>
      expect(listRecordTitles(panel, "procedures")).toEqual([
        "Tooth extraction",
      ]),
    );
  });

  it("finds a procedure by any part of its name or of a coding's display", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    await createProcedure(medplum, "Skin biopsy", "2024-03-12");
    await createProcedure(medplum, "Mole removal", "2025-02-03");
    await createProcedure(medplum, "Coded only", "2023-05-01", {
      code: {
        coding: [{ code: "240977001", display: "Biopsy of skin" }],
      },
    });
    const search = answerAsServer(medplum);
    renderHealthRecords(medplum, "/health-records?tab=procedures");
    const panel = screen.getByTestId("procedures-panel");
    await within(panel).findByTestId("procedures-list");

    await searchRecords(user, "biopsy");

    await waitFor(() =>
      expect(listRecordTitles(panel, "procedures")).toEqual([
        "Skin biopsy",
        "Biopsy of skin",
      ]),
    );
    expect(
      listFilterValues(
        medplum,
        search,
        RESOURCE_TYPE.PROCEDURE,
        isTextFilter,
      ).filter((value) => value !== undefined),
    ).toEqual(["biopsy", "biopsy"]);
  });

  it("shows the newest page of procedures first, and the older ones when the patient asks for more", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    const procedureCount = constant.SEARCH_PAGE_SIZE + 1;
    for (let index = 0; index < procedureCount; index += 1) {
      await createProcedure(
        medplum,
        `Procedure ${index + 1}`,
        new Date(Date.UTC(2020, 0, 1 + index)).toISOString().slice(0, 10),
      );
    }

    renderHealthRecords(medplum, "/health-records?tab=procedures");
    const list = await screen.findByTestId("procedures-list");
    expect(within(list).getAllByTestId("procedures-record")).toHaveLength(
      constant.SEARCH_PAGE_SIZE,
    );
    await user.click(screen.getByTestId("procedures-more"));

    await waitFor(() =>
      expect(within(list).getAllByTestId("procedures-record")).toHaveLength(
        procedureCount,
      ),
    );
    expect(listRecordTitles(list, "procedures").at(-1)).toBe("Procedure 1");
  });

  it("keeps the procedures already listed when the next page cannot be read, and reads that page when the patient tries again", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    const procedureCount = constant.SEARCH_PAGE_SIZE + 1;
    for (let index = 0; index < procedureCount; index += 1) {
      await createProcedure(
        medplum,
        `Procedure ${index + 1}`,
        new Date(Date.UTC(2020, 0, 1 + index)).toISOString().slice(0, 10),
      );
    }
    let isProcedureReachable = true;
    failSearches(
      medplum,
      (resourceType) =>
        resourceType === RESOURCE_TYPE.PROCEDURE && !isProcedureReachable,
    );

    renderHealthRecords(medplum, "/health-records?tab=procedures");
    const list = await screen.findByTestId("procedures-list");
    isProcedureReachable = false;
    await user.click(screen.getByTestId("procedures-more"));

    const error = await screen.findByTestId("health-records-error");
    expect(within(list).getAllByTestId("procedures-record")).toHaveLength(
      constant.SEARCH_PAGE_SIZE,
    );
    expect(
      screen.queryByTestId("procedures-unavailable"),
    ).not.toBeInTheDocument();
    isProcedureReachable = true;
    await user.click(within(error).getByRole("button"));

    await waitFor(() =>
      expect(within(list).getAllByTestId("procedures-record")).toHaveLength(
        procedureCount,
      ),
    );
    expect(
      screen.queryByTestId("health-records-error"),
    ).not.toBeInTheDocument();
  });

  it("shows an error and marks Procedures when they could not be read, keeping the others, and lists them once the patient tries again", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    await createCondition(medplum, "Eczema", "2026-10-20");
    await createProcedure(medplum, "Skin biopsy", "2024-03-12");
    let isProcedureReachable = false;
    failSearches(
      medplum,
      (resourceType) =>
        resourceType === RESOURCE_TYPE.PROCEDURE && !isProcedureReachable,
    );

    renderHealthRecords(medplum);
    await screen.findByTestId("conditions-list");
    const panel = await openTab(user, "procedures");

    const error = await screen.findByTestId("health-records-error");
    expect(error).toHaveTextContent(constant.DEFAULT_ERROR_MESSAGE);
    expect(
      within(panel).getByTestId("procedures-unavailable"),
    ).toHaveTextContent("Could not load");
    const conditions = await openTab(user, "conditions");
    expect(
      listRecordTitles(
        within(conditions).getByTestId("conditions-list"),
        "conditions",
      ),
    ).toEqual(["Eczema"]);

    isProcedureReachable = true;
    await openTab(user, "procedures");
    await user.click(
      within(screen.getByTestId("health-records-error")).getByRole("button"),
    );

    expect(
      listRecordTitles(
        await within(panel).findByTestId("procedures-list"),
        "procedures",
      ),
    ).toEqual(["Skin biopsy"]);
    expect(
      screen.queryByTestId("health-records-error"),
    ).not.toBeInTheDocument();
  });
});

describe("Health records, immunizations", () => {
  const givenByPine = { actor: { display: "Immunization service" } };

  it("lists the patient's immunizations newest first, with the clinic, the day, who gave each and its status", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    await createRecordSources(medplum, [pineFamilyClinic]);
    includeListedOrganizations(medplum);
    await createImmunization(medplum, "Tetanus vaccine", "2023-04-11", {
      meta: { source: pineFamilyClinic.address },
      performer: [givenByPine],
    });
    await createImmunization(medplum, "Influenza vaccine", "2025-10-06", {
      meta: { source: pineFamilyClinic.address },
      performer: [givenByPine],
    });

    renderHealthRecords(medplum);
    await screen.findByTestId("conditions-empty");
    const panel = await openTab(user, "immunizations");

    await waitFor(() =>
      expect(listRecordTexts(panel, "immunizations")).toEqual([
        "Influenza vaccinePine Synthetic Family Clinic · October 6, 2025Immunization serviceCompletedView record",
        "Tetanus vaccinePine Synthetic Family Clinic · April 11, 2023Immunization serviceCompletedView record",
      ]),
    );
    expect(
      within(panel)
        .getAllByTestId("immunizations-record-status")
        .map(({ textContent }) => textContent),
    ).toEqual(["Completed", "Completed"]);
  });

  it("names the clinic once when the clinic itself is recorded as giving the vaccine", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    await createRecordSources(medplum, [pineFamilyClinic]);
    includeListedOrganizations(medplum);
    await createImmunization(medplum, "Influenza vaccine", "2025-10-06", {
      meta: { source: pineFamilyClinic.address },
      performer: [{ actor: { display: pineFamilyClinic.name } }],
    });

    renderHealthRecords(medplum, "/health-records?tab=immunizations");
    const panel = screen.getByTestId("immunizations-panel");

    await waitFor(() =>
      expect(listRecordTexts(panel, "immunizations")).toEqual([
        "Influenza vaccinePine Synthetic Family Clinic · October 6, 2025CompletedView record",
      ]),
    );
  });

  it("asks Medplum for the patient's own immunizations, newest first, leaving out those entered in error", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    const search = vi.spyOn(medplum, "search");

    renderHealthRecords(medplum, "/health-records?tab=immunizations");
    await within(screen.getByTestId("immunizations-panel")).findByTestId(
      "immunizations-empty",
    );

    const [resourceType, query] =
      search.mock.calls.find(
        ([searchedResourceType]) =>
          searchedResourceType === RESOURCE_TYPE.IMMUNIZATION,
      ) ?? [];
    const { filters, sortRules } = parseSearchRequest(
      `${resourceType}${String(query)}`,
    );
    expect(filters).toEqual(
      expect.arrayContaining([
        {
          code: SEARCH_PARAMETER.PATIENT,
          operator: Operator.EQUALS,
          value: getReferenceString(HomerSimpson),
        },
        {
          code: SEARCH_PARAMETER.STATUS,
          operator: Operator.NOT,
          value: IMMUNIZATION_STATUS.ENTERED_IN_ERROR,
        },
      ]),
    );
    expect(sortRules).toEqual([
      { code: SEARCH_PARAMETER.DATE, descending: true },
    ]);
  });

  it("names everyone who gave or ordered a vaccine, each once", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    await createImmunization(medplum, "Influenza vaccine", "2025-10-06", {
      performer: [
        { function: { text: "Ordering Provider" }, actor: doctor },
        { actor: { display: "Nurse Ana Synthetic" } },
        { function: { text: "Administering Provider" }, actor: doctor },
        { actor: { reference: `${RESOURCE_TYPE.PRACTITIONER}/unnamed` } },
      ],
    });

    renderHealthRecords(medplum);
    await screen.findByTestId("conditions-empty");
    const panel = await openTab(user, "immunizations");

    expect(
      await within(panel).findByTestId("immunizations-record"),
    ).toHaveTextContent(
      "Influenza vaccineOctober 6, 2025Dr. Mira Synthetic, Nurse Ana SyntheticCompletedView record",
    );
  });

  it("tags a vaccine recorded as not given as not given, in the list and in its record, never as completed", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    await createImmunization(medplum, "Influenza vaccine", "2025-10-06", {
      status: IMMUNIZATION_STATUS.NOT_DONE,
    });

    renderHealthRecords(medplum);
    await screen.findByTestId("conditions-empty");
    const panel = await openTab(user, "immunizations");
    const row = await within(panel).findByTestId("immunizations-record");
    expect(row).toHaveTextContent(
      "Influenza vaccineOctober 6, 2025Dr. Mira SyntheticNot givenView record",
    );
    expect(
      within(row).getByTestId("immunizations-record-status").textContent,
    ).toBe("Not given");
    await user.click(
      within(row).getByRole("button", {
        name: "View record: Influenza vaccine",
      }),
    );

    const dialog = await screen.findByTestId("health-record-dialog");
    expect(within(dialog).getByTestId("health-record-status").textContent).toBe(
      "Not given",
    );
    expect(dialog).not.toHaveTextContent("Completed");
  });

  it("tags a dose the clinic marked subpotent as a subpotent dose, in the list and in its record, never as completed", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    await createImmunization(medplum, "Influenza vaccine", "2025-10-06", {
      isSubpotent: true,
    });

    renderHealthRecords(medplum);
    await screen.findByTestId("conditions-empty");
    const panel = await openTab(user, "immunizations");
    const row = await within(panel).findByTestId("immunizations-record");
    expect(row).toHaveTextContent(
      "Influenza vaccineOctober 6, 2025Dr. Mira SyntheticSubpotent doseView record",
    );
    expect(
      within(row).getByTestId("immunizations-record-status").textContent,
    ).toBe("Subpotent dose");
    await user.click(
      within(row).getByRole("button", {
        name: "View record: Influenza vaccine",
      }),
    );

    const dialog = await screen.findByTestId("health-record-dialog");
    expect(within(dialog).getByTestId("health-record-status").textContent).toBe(
      "Subpotent dose",
    );
    expect(dialog).not.toHaveTextContent("Completed");
  });

  it("dates an immunization whose date is written as text when the text is a date", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    await createImmunization(medplum, "Childhood measles vaccine", undefined, {
      occurrenceString: "2019-05",
    });

    renderHealthRecords(medplum);
    await screen.findByTestId("conditions-empty");
    const panel = await openTab(user, "immunizations");

    expect(
      await within(panel).findByTestId("immunizations-record"),
    ).toHaveTextContent(
      "Childhood measles vaccineMay 2019Dr. Mira SyntheticCompletedView record",
    );
  });

  it("lists immunizations with no date after the dated ones", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    answerAsServer(medplum);
    await createImmunization(medplum, "Tetanus vaccine", "2023-04-11");
    await createImmunization(medplum, "Childhood measles vaccine", undefined, {
      occurrenceString: "Spring 2019",
    });
    await createImmunization(medplum, "Influenza vaccine", "2025-10-06");

    renderHealthRecords(medplum);
    await screen.findByTestId("conditions-empty");
    const panel = await openTab(user, "immunizations");

    expect(
      listRecordTitles(
        await within(panel).findByTestId("immunizations-list"),
        "immunizations",
      ),
    ).toEqual([
      "Influenza vaccine",
      "Tetanus vaccine",
      "Childhood measles vaccine",
    ]);
  });

  it("shows only the signed-in patient's immunizations", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    const otherPatient = await medplum.createResource<Patient>({
      resourceType: RESOURCE_TYPE.PATIENT,
      name: [{ given: ["Harper"], family: "Synthetic" }],
    });
    await createImmunization(
      medplum,
      "Another patient's vaccine",
      "2025-10-07",
      { patient: createReference(otherPatient) },
    );
    await createImmunization(medplum, "Influenza vaccine", "2025-10-06");

    renderHealthRecords(medplum);
    await screen.findByTestId("conditions-empty");
    const panel = await openTab(user, "immunizations");

    expect(
      listRecordTitles(
        await within(panel).findByTestId("immunizations-list"),
        "immunizations",
      ),
    ).toEqual(["Influenza vaccine"]);
  });

  it("opens an immunization in a dialog with its status, the clinic's notes in order, the clinic, the day and who gave it", async () => {
    receiveRecordsAt(RECEIVED_AT);
    showDatesInChicago();
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    await createRecordSources(medplum, [pineFamilyClinic]);
    includeListedOrganizations(medplum);
    await createImmunization(medplum, "Influenza vaccine", "2025-10-06", {
      meta: { source: pineFamilyClinic.address },
      performer: [givenByPine],
      note: [
        { text: "One historical influenza dose is recorded." },
        { text: "Taken from a written record." },
      ],
    });

    renderHealthRecords(medplum, "/health-records?tab=immunizations");
    const panel = screen.getByTestId("immunizations-panel");
    await waitFor(() =>
      expect(
        within(panel).getByTestId("immunizations-record"),
      ).toHaveTextContent(pineFamilyClinic.name),
    );
    await user.click(
      within(panel).getByRole("button", {
        name: "View record: Influenza vaccine",
      }),
    );

    const dialog = await screen.findByTestId("health-record-dialog");
    expect(dialog).toHaveAccessibleName("Influenza vaccine");
    expect(within(dialog).getByTestId("health-record-status").textContent).toBe(
      "Completed",
    );
    expect(listNoteTexts(dialog)).toEqual([
      "One historical influenza dose is recorded.",
      "Taken from a written record.",
    ]);
    expect(
      within(dialog).getByTestId("health-record-details"),
    ).toHaveTextContent(
      "PatientHomer SimpsonSourcePine Synthetic Family ClinicDateOctober 6, 2025ReceivedOctober 28, 2026 · 4:10 PM Central TimeAuthorImmunization service",
    );
  });

  it("lists only the chosen source's immunizations", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    const pine = await createClinic(medplum, pineFamilyClinic);
    const oak = await createClinic(medplum, oakDermatology);
    await listClinics(medplum, [pine, oak]);
    await createImmunization(medplum, "Influenza vaccine", "2025-10-06", {
      meta: { source: pineFamilyClinic.address },
    });
    await createImmunization(medplum, "Tetanus vaccine", "2023-04-11", {
      meta: { source: oakDermatology.address },
    });
    const search = answerAsServer(medplum);
    renderHealthRecords(medplum, "/health-records?tab=immunizations");
    const panel = screen.getByTestId("immunizations-panel");
    await within(panel).findByTestId("immunizations-list");

    await chooseRecordSource(user, pineFamilyClinic.name);

    await waitFor(() =>
      expect(listRecordTitles(panel, "immunizations")).toEqual([
        "Influenza vaccine",
      ]),
    );

    await chooseRecordSource(user, oakDermatology.name);

    await waitFor(() =>
      expect(listRecordTitles(panel, "immunizations")).toEqual([
        "Tetanus vaccine",
      ]),
    );
    expect(
      listFilterValues(
        medplum,
        search,
        RESOURCE_TYPE.IMMUNIZATION,
        isSourceFilter,
      ).filter((value) => value !== undefined),
    ).toEqual(
      expect.arrayContaining([
        escapeSearchValue(pineFamilyClinic.address),
        escapeSearchValue(oakDermatology.address),
      ]),
    );
  });

  it("finds an immunization by any part of the vaccine's name or of a coding's display, ignoring case", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    await createImmunization(medplum, "Influenza vaccine", "2025-10-06");
    await createImmunization(medplum, "Tetanus vaccine", "2023-04-11");
    await createImmunization(medplum, "Coded only", "2024-10-01", {
      vaccineCode: {
        coding: [{ code: "88", display: "influenza, unspecified formulation" }],
      },
    });
    const search = answerAsServer(medplum);
    renderHealthRecords(medplum, "/health-records?tab=immunizations");
    const panel = screen.getByTestId("immunizations-panel");
    await within(panel).findByTestId("immunizations-list");

    await searchRecords(user, "INFLU");

    await waitFor(() =>
      expect(listRecordTitles(panel, "immunizations")).toEqual([
        "Influenza vaccine",
        "influenza, unspecified formulation",
      ]),
    );
    expect(
      listFilterValues(
        medplum,
        search,
        RESOURCE_TYPE.IMMUNIZATION,
        isVaccineCodeTextFilter,
      ).filter((value) => value !== undefined),
    ).toEqual(["INFLU", "INFLU"]);
    expect(
      listFilterValues(
        medplum,
        search,
        RESOURCE_TYPE.IMMUNIZATION,
        isTextFilter,
      ).filter((value) => value !== undefined),
    ).toEqual([]);
  });

  it("keeps the chosen source and search when the patient asks for more immunizations", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    const pine = await createClinic(medplum, pineFamilyClinic);
    const oak = await createClinic(medplum, oakDermatology);
    await listClinics(medplum, [pine, oak]);
    const immunizationCount = constant.SEARCH_PAGE_SIZE + 1;
    for (let index = 0; index < immunizationCount; index += 1) {
      await createImmunization(
        medplum,
        `Influenza vaccine ${index + 1}`,
        new Date(Date.UTC(2020, 0, 1 + index)).toISOString().slice(0, 10),
        { meta: { source: pineFamilyClinic.address } },
      );
    }
    await createImmunization(medplum, "Tetanus vaccine", "2026-10-20", {
      meta: { source: pineFamilyClinic.address },
    });
    await createImmunization(
      medplum,
      "Influenza vaccine at the dermatologist",
      "2026-10-21",
      { meta: { source: oakDermatology.address } },
    );
    const search = answerAsServer(medplum);
    renderHealthRecords(
      medplum,
      `/health-records?tab=immunizations&source=${pine.id}&search=influ`,
    );
    const panel = screen.getByTestId("immunizations-panel");
    await waitFor(() =>
      expect(within(panel).getAllByTestId("immunizations-record")).toHaveLength(
        constant.SEARCH_PAGE_SIZE,
      ),
    );

    await user.click(within(panel).getByTestId("immunizations-more"));

    await waitFor(() =>
      expect(within(panel).getAllByTestId("immunizations-record")).toHaveLength(
        immunizationCount,
      ),
    );
    expect(listRecordTitles(panel, "immunizations")).not.toEqual(
      expect.arrayContaining(["Tetanus vaccine"]),
    );
    expect(listRecordTitles(panel, "immunizations")).not.toEqual(
      expect.arrayContaining(["Influenza vaccine at the dermatologist"]),
    );
    const nextPageRequest = readSearchRequest(
      medplum,
      RESOURCE_TYPE.IMMUNIZATION,
      search.mock.calls.filter(
        ([resourceType]) => resourceType === RESOURCE_TYPE.IMMUNIZATION,
      )[1][1] as string,
    );
    expect(nextPageRequest.offset).toBe(constant.SEARCH_PAGE_SIZE);
    expect(nextPageRequest.filters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: SEARCH_PARAMETER.SOURCE,
          value: pineFamilyClinic.address,
        }),
        expect.objectContaining({
          code: SEARCH_PARAMETER.VACCINE_CODE,
          operator: Operator.TEXT,
          value: "influ",
        }),
      ]),
    );
  });

  it("shows the newest page of immunizations first, and the older ones when the patient asks for more", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    const immunizationCount = constant.SEARCH_PAGE_SIZE + 1;
    for (let index = 0; index < immunizationCount; index += 1) {
      await createImmunization(
        medplum,
        `Vaccine ${index + 1}`,
        new Date(Date.UTC(2020, 0, 1 + index)).toISOString().slice(0, 10),
      );
    }

    renderHealthRecords(medplum, "/health-records?tab=immunizations");
    const list = await screen.findByTestId("immunizations-list");
    expect(within(list).getAllByTestId("immunizations-record")).toHaveLength(
      constant.SEARCH_PAGE_SIZE,
    );
    await user.click(screen.getByTestId("immunizations-more"));

    await waitFor(() =>
      expect(within(list).getAllByTestId("immunizations-record")).toHaveLength(
        immunizationCount,
      ),
    );
    expect(listRecordTitles(list, "immunizations").at(-1)).toBe("Vaccine 1");
  });

  it("keeps the immunizations already listed when the next page cannot be read, and reads that page when the patient tries again", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    const immunizationCount = constant.SEARCH_PAGE_SIZE + 1;
    for (let index = 0; index < immunizationCount; index += 1) {
      await createImmunization(
        medplum,
        `Vaccine ${index + 1}`,
        new Date(Date.UTC(2020, 0, 1 + index)).toISOString().slice(0, 10),
      );
    }
    let isImmunizationReachable = true;
    failSearches(
      medplum,
      (resourceType) =>
        resourceType === RESOURCE_TYPE.IMMUNIZATION && !isImmunizationReachable,
    );

    renderHealthRecords(medplum, "/health-records?tab=immunizations");
    const list = await screen.findByTestId("immunizations-list");
    isImmunizationReachable = false;
    await user.click(screen.getByTestId("immunizations-more"));

    const error = await screen.findByTestId("health-records-error");
    expect(within(list).getAllByTestId("immunizations-record")).toHaveLength(
      constant.SEARCH_PAGE_SIZE,
    );
    expect(
      screen.queryByTestId("immunizations-unavailable"),
    ).not.toBeInTheDocument();
    isImmunizationReachable = true;
    await user.click(within(error).getByRole("button"));

    await waitFor(() =>
      expect(within(list).getAllByTestId("immunizations-record")).toHaveLength(
        immunizationCount,
      ),
    );
    expect(
      screen.queryByTestId("health-records-error"),
    ).not.toBeInTheDocument();
  });

  it("shows an error and marks Immunizations when they could not be read, keeping the others, and lists them once the patient tries again", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    await createCondition(medplum, "Eczema", "2026-10-20");
    await createImmunization(medplum, "Influenza vaccine", "2025-10-06");
    let isImmunizationReachable = false;
    failSearches(
      medplum,
      (resourceType) =>
        resourceType === RESOURCE_TYPE.IMMUNIZATION && !isImmunizationReachable,
    );

    renderHealthRecords(medplum);
    await screen.findByTestId("conditions-list");
    const panel = await openTab(user, "immunizations");

    const error = await screen.findByTestId("health-records-error");
    expect(error).toHaveTextContent(constant.DEFAULT_ERROR_MESSAGE);
    expect(
      within(panel).getByTestId("immunizations-unavailable"),
    ).toHaveTextContent("Could not load");
    const conditions = await openTab(user, "conditions");
    expect(
      listRecordTitles(
        within(conditions).getByTestId("conditions-list"),
        "conditions",
      ),
    ).toEqual(["Eczema"]);

    isImmunizationReachable = true;
    await openTab(user, "immunizations");
    await user.click(
      within(screen.getByTestId("health-records-error")).getByRole("button"),
    );

    expect(
      listRecordTitles(
        await within(panel).findByTestId("immunizations-list"),
        "immunizations",
      ),
    ).toEqual(["Influenza vaccine"]);
    expect(
      screen.queryByTestId("health-records-error"),
    ).not.toBeInTheDocument();
  });
});
