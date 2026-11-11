import {
  createReference,
  formatSearchQuery,
  getReferenceString,
  Operator,
  parseSearchRequest,
  type Filter,
  type SearchRequest,
} from "@medplum/core";
import type {
  MedicationRequest,
  Patient,
  ResourceType,
} from "@medplum/fhirtypes";
import { HomerSimpson, MockClient } from "@medplum/mock";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it, vi, type MockInstance } from "vitest";

import constant from "../../constants";
import {
  ALLERGY_INTOLERANCE_CLINICAL_STATUS,
  ALLERGY_INTOLERANCE_VERIFICATION_STATUS,
  BUNDLE_LINK_RELATION,
  CARE_PLAN_STATUS,
  CODE_SYSTEM,
  MEDICATION_REQUEST_ELEMENT,
  MEDICATION_REQUEST_INTENT,
  MEDICATION_REQUEST_STATUS,
  RESOURCE_TYPE,
  SEARCH_PARAMETER,
  SEARCH_TOTAL,
  SEARCH_VALUE_SEPARATOR,
} from "../../constants/fhir";
import routes from "../../constants/routes";
import {
  AllergyIntoleranceProvider,
  CarePlanProvider,
  MedicationRequestProvider,
} from "../../providers";
import {
  codeFrom,
  createAllergyIntolerance,
  createCarePlan,
  createMedicationRequest,
  interceptSearches,
  networkFailure,
} from "../../test-medplum";
import { TestProviders } from "../../test-providers";
import HealthProfile from "./health-profile.page";

const homer = createReference(HomerSimpson);

const renderHealthProfile = (medplum: MockClient) => {
  const router = createMemoryRouter(
    [
      {
        path: routes.HEALTH_PROFILE,
        element: (
          <CarePlanProvider>
            <MedicationRequestProvider>
              <AllergyIntoleranceProvider>
                <HealthProfile />
              </AllergyIntoleranceProvider>
            </MedicationRequestProvider>
          </CarePlanProvider>
        ),
      },
    ],
    { initialEntries: [routes.HEALTH_PROFILE] },
  );
  render(
    <TestProviders medplum={medplum}>
      <RouterProvider router={router} />
    </TestProviders>,
  );
};

const createAnotherPatient = (medplum: MockClient): Promise<Patient> =>
  medplum.createResource<Patient>({
    resourceType: RESOURCE_TYPE.PATIENT,
    name: [{ given: ["Rowan"], family: "Synthetic" }],
  });

const parseSearchQuery = (
  resourceType: string,
  query: Parameters<MockClient["search"]>[1],
) =>
  parseSearchRequest(
    `${resourceType}?${new URLSearchParams(query as string | URLSearchParams)}`,
  );

const failSearchesMatching = (
  medplum: MockClient,
  shouldFail: (searchRequest: SearchRequest) => boolean,
) =>
  interceptSearches(medplum, (search, resourceType, query) =>
    shouldFail(parseSearchQuery(resourceType, query))
      ? Promise.reject(networkFailure())
      : search(),
  );

const isSearchOf =
  (searchedResourceType: ResourceType) =>
  ({ resourceType }: SearchRequest) =>
    resourceType === searchedResourceType;

const answerOneRecordPerPage = (
  medplum: MockClient,
  pagedResourceType: ResourceType,
  failingOffset?: number,
) =>
  interceptSearches(medplum, async (search, resourceType, query) => {
    if (resourceType !== pagedResourceType) {
      return search();
    }
    const searchRequest = parseSearchQuery(resourceType, query);
    const offset = searchRequest.offset ?? 0;
    if (offset === failingOffset) {
      throw networkFailure();
    }
    const bundle = await search();
    const [firstEntry, ...laterEntries] = bundle.entry ?? [];
    const nextPage = medplum.fhirSearchUrl(
      pagedResourceType,
      formatSearchQuery({ ...searchRequest, offset: offset + 1 }),
    );
    return {
      ...bundle,
      entry: firstEntry ? [firstEntry] : [],
      link: laterEntries.length
        ? [{ relation: BUNDLE_LINK_RELATION.NEXT, url: nextPage.toString() }]
        : [],
    };
  });

const sortFilters = (filters: Filter[] = []) =>
  filters.toSorted((first, second) =>
    JSON.stringify(first).localeCompare(JSON.stringify(second)),
  );

const listSearches = (
  search: MockInstance<MockClient["search"]>,
  resourceType: ResourceType,
) =>
  search.mock.calls
    .filter(([calledResourceType]) => calledResourceType === resourceType)
    .map(([, query, options]) => {
      expect(options).toEqual(expect.objectContaining({ cache: "reload" }));
      const { count, fields, filters, sortRules, total } = parseSearchQuery(
        resourceType,
        query,
      );
      return { count, fields, filters: sortFilters(filters), sortRules, total };
    });

const patientFilter = {
  code: SEARCH_PARAMETER.PATIENT,
  operator: Operator.EQUALS,
  value: getReferenceString(homer),
};

const activeAllergyFilters = [
  patientFilter,
  {
    code: SEARCH_PARAMETER.CLINICAL_STATUS,
    operator: Operator.EQUALS,
    value: ALLERGY_INTOLERANCE_CLINICAL_STATUS.ACTIVE,
  },
  {
    code: SEARCH_PARAMETER.VERIFICATION_STATUS,
    operator: Operator.NOT,
    value: [
      ALLERGY_INTOLERANCE_VERIFICATION_STATUS.REFUTED,
      ALLERGY_INTOLERANCE_VERIFICATION_STATUS.ENTERED_IN_ERROR,
    ].join(SEARCH_VALUE_SEPARATOR),
  },
];

const dateMissingFilter = (hasDate: boolean) => ({
  code: SEARCH_PARAMETER.DATE,
  operator: Operator.MISSING,
  value: String(!hasDate),
});

const activeAllergySearch = (hasDate: boolean) => ({
  count: constant.SEARCH_PREVIEW_SIZE,
  filters: sortFilters([...activeAllergyFilters, dateMissingFilter(hasDate)]),
  sortRules: [
    hasDate
      ? { code: SEARCH_PARAMETER.DATE, descending: true }
      : { code: SEARCH_PARAMETER.ID, descending: false },
  ],
  total: SEARCH_TOTAL.ACCURATE,
});

const recordedAllergyCount = {
  count: 0,
  filters: sortFilters([
    patientFilter,
    {
      code: SEARCH_PARAMETER.VERIFICATION_STATUS,
      operator: Operator.NOT,
      value: ALLERGY_INTOLERANCE_VERIFICATION_STATUS.ENTERED_IN_ERROR,
    },
  ]),
  total: SEARCH_TOTAL.ACCURATE,
};

const isActiveAllergySearch =
  (hasDate: boolean) =>
  ({ filters, resourceType }: SearchRequest) =>
    resourceType === RESOURCE_TYPE.ALLERGY_INTOLERANCE &&
    JSON.stringify(sortFilters(filters)) ===
      JSON.stringify(activeAllergySearch(hasDate).filters);

const isRecordedAllergyCount = ({ count, resourceType }: SearchRequest) =>
  resourceType === RESOURCE_TYPE.ALLERGY_INTOLERANCE && count === 0;

const ROW_TEST_IDENTIFIERS = [
  "health-profile-active-care-plans",
  "health-profile-active-prescriptions",
  "health-profile-active-allergies",
];

describe("Health profile", () => {
  it("shows whose record it is, the title, and who the patient is", async () => {
    renderHealthProfile(new MockClient({ profile: HomerSimpson }));

    expect(
      await screen.findByTestId("health-profile-record-owner"),
    ).toHaveTextContent("Your record · Homer Simpson");
    const title = screen.getByTestId("health-profile-title");
    expect(title.tagName).toBe("H1");
    expect(title).toHaveTextContent("Health profile");
    const aboutYou = screen.getByTestId("about-you");
    expect(aboutYou.tagName).toBe("DL");
    expect(
      Array.from(aboutYou.children, ({ tagName, textContent }) => [
        tagName,
        textContent,
      ]),
    ).toEqual([
      ["DT", "Patient"],
      ["DD", "Homer Simpson"],
      ["DT", "Record access"],
      ["DD", "Your own record"],
    ]);
    expect(
      await screen.findByTestId("health-profile-active-allergies"),
    ).toBeInTheDocument();
  });

  it("shows loading in each row until the record answers, in a list that announces the answers", async () => {
    renderHealthProfile(new MockClient({ profile: HomerSimpson }));

    const atAGlance = screen.getByTestId("at-a-glance");
    expect(atAGlance).toHaveAttribute("aria-live", "polite");
    for (const testIdentifier of ROW_TEST_IDENTIFIERS) {
      expect(within(atAGlance).getByTestId(`${testIdentifier}-row`)).toHaveRole(
        "listitem",
      );
      expect(screen.getByTestId(`${testIdentifier}-loading`)).toHaveTextContent(
        "Loading…",
      );
    }
    expect(
      await screen.findByTestId("health-profile-active-allergies"),
    ).toBeInTheDocument();
  });

  it("says what an empty record holds", async () => {
    renderHealthProfile(new MockClient({ profile: HomerSimpson }));

    expect(
      await screen.findByTestId("health-profile-active-care-plans"),
    ).toHaveTextContent("No ongoing plans");
    expect(
      await screen.findByTestId("health-profile-active-prescriptions"),
    ).toHaveTextContent("No active prescriptions");
    expect(
      await screen.findByTestId("health-profile-active-allergies"),
    ).toHaveTextContent("Not yet recorded");
  });

  it("counts only active care plans, in the same words as Home", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    await createCarePlan(medplum, CARE_PLAN_STATUS.ACTIVE);
    await createCarePlan(medplum, CARE_PLAN_STATUS.ACTIVE);
    await createCarePlan(medplum, CARE_PLAN_STATUS.COMPLETED);

    renderHealthProfile(medplum);

    expect(
      await screen.findByTestId("health-profile-active-care-plans"),
    ).toHaveTextContent("2 ongoing plans");
  });

  it("counts only active prescription orders, leaving out proposals, repeated orders and other statuses", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    const orders: Partial<MedicationRequest>[] = [
      {},
      { intent: MEDICATION_REQUEST_INTENT.ORIGINAL_ORDER },
      { intent: MEDICATION_REQUEST_INTENT.PROPOSAL },
      { intent: MEDICATION_REQUEST_INTENT.FILLER_ORDER },
      { status: MEDICATION_REQUEST_STATUS.ON_HOLD },
      { status: MEDICATION_REQUEST_STATUS.COMPLETED },
      { status: MEDICATION_REQUEST_STATUS.DRAFT },
      { status: MEDICATION_REQUEST_STATUS.ENTERED_IN_ERROR },
    ];
    for (const order of orders) {
      await createMedicationRequest(
        medplum,
        "Cetirizine 10 mg tablet",
        "2026-10-20",
        order,
      );
    }

    renderHealthProfile(medplum);

    expect(
      await screen.findByTestId("health-profile-active-prescriptions"),
    ).toHaveTextContent("2 active prescriptions");
  });

  it("counts one active prescription in the singular", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    await createMedicationRequest(
      medplum,
      "Cetirizine 10 mg tablet",
      "2026-10-20",
    );

    renderHealthProfile(medplum);

    expect(
      await screen.findByTestId("health-profile-active-prescriptions"),
    ).toHaveTextContent("1 active prescription");
  });

  it("leaves out active orders not to take a medicine", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    await createMedicationRequest(
      medplum,
      "Cetirizine 10 mg tablet",
      "2026-10-20",
    );
    await createMedicationRequest(
      medplum,
      "Cetirizine 10 mg tablet",
      "2026-10-20",
      { doNotPerform: true },
    );

    renderHealthProfile(medplum);

    expect(
      await screen.findByTestId("health-profile-active-prescriptions"),
    ).toHaveTextContent("1 active prescription");
  });

  it("counts the active prescriptions on every page Medplum answers with", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    for (const doNotPerform of [false, true, false]) {
      await createMedicationRequest(
        medplum,
        "Cetirizine 10 mg tablet",
        "2026-10-20",
        { doNotPerform },
      );
    }
    answerOneRecordPerPage(medplum, RESOURCE_TYPE.MEDICATION_REQUEST);

    renderHealthProfile(medplum);

    expect(
      await screen.findByTestId("health-profile-active-prescriptions"),
    ).toHaveTextContent("2 active prescriptions");
  });

  it("names only active allergies, leaving out inactive, resolved, ruled-out and mistaken ones", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    await createAllergyIntolerance(
      medplum,
      { text: "Penicillin" },
      "2026-10-20",
    );
    await createAllergyIntolerance(medplum, { text: "Latex" }, "2026-10-20", {
      clinicalStatus: codeFrom(
        CODE_SYSTEM.ALLERGY_INTOLERANCE_CLINICAL,
        ALLERGY_INTOLERANCE_CLINICAL_STATUS.INACTIVE,
      ),
    });
    await createAllergyIntolerance(medplum, { text: "Peanuts" }, "2026-10-20", {
      clinicalStatus: codeFrom(
        CODE_SYSTEM.ALLERGY_INTOLERANCE_CLINICAL,
        ALLERGY_INTOLERANCE_CLINICAL_STATUS.RESOLVED,
      ),
    });
    await createAllergyIntolerance(
      medplum,
      { text: "Sulfa drugs" },
      "2026-10-20",
      {
        verificationStatus: codeFrom(
          CODE_SYSTEM.ALLERGY_INTOLERANCE_VERIFICATION,
          ALLERGY_INTOLERANCE_VERIFICATION_STATUS.REFUTED,
        ),
      },
    );
    await createAllergyIntolerance(
      medplum,
      { text: "Shellfish" },
      "2026-10-20",
      {
        clinicalStatus: undefined,
        verificationStatus: codeFrom(
          CODE_SYSTEM.ALLERGY_INTOLERANCE_VERIFICATION,
          ALLERGY_INTOLERANCE_VERIFICATION_STATUS.ENTERED_IN_ERROR,
        ),
      },
    );

    renderHealthProfile(medplum);

    expect(
      await screen.findByTestId("health-profile-active-allergies"),
    ).toHaveTextContent(/^Penicillin$/);
  });

  it("names an active allergy that has no verification status", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    await createAllergyIntolerance(
      medplum,
      { text: "Bee venom" },
      "2026-10-20",
      { verificationStatus: undefined },
    );

    renderHealthProfile(medplum);

    expect(
      await screen.findByTestId("health-profile-active-allergies"),
    ).toHaveTextContent(/^Bee venom$/);
  });

  it("says no allergy is active when every recorded allergy is inactive, resolved or ruled out", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    await createAllergyIntolerance(medplum, { text: "Latex" }, "2026-10-20", {
      clinicalStatus: codeFrom(
        CODE_SYSTEM.ALLERGY_INTOLERANCE_CLINICAL,
        ALLERGY_INTOLERANCE_CLINICAL_STATUS.RESOLVED,
      ),
    });
    await createAllergyIntolerance(
      medplum,
      { text: "Sulfa drugs" },
      "2026-10-20",
      {
        verificationStatus: codeFrom(
          CODE_SYSTEM.ALLERGY_INTOLERANCE_VERIFICATION,
          ALLERGY_INTOLERANCE_VERIFICATION_STATUS.REFUTED,
        ),
      },
    );

    renderHealthProfile(medplum);

    expect(
      await screen.findByTestId("health-profile-active-allergies"),
    ).toHaveTextContent("No active allergies recorded");
  });

  it("says allergies are not yet recorded when the only allergy record was entered in error", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    await createAllergyIntolerance(
      medplum,
      { text: "Shellfish" },
      "2026-10-20",
      {
        clinicalStatus: undefined,
        verificationStatus: codeFrom(
          CODE_SYSTEM.ALLERGY_INTOLERANCE_VERIFICATION,
          ALLERGY_INTOLERANCE_VERIFICATION_STATUS.ENTERED_IN_ERROR,
        ),
      },
    );

    renderHealthProfile(medplum);

    expect(
      await screen.findByTestId("health-profile-active-allergies"),
    ).toHaveTextContent("Not yet recorded");
  });

  it("names the three newest active allergies and counts the rest", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    await createAllergyIntolerance(medplum, { text: "Oldest" }, "2026-01-01");
    await createAllergyIntolerance(
      medplum,
      { text: "Penicillin" },
      "2026-10-01",
    );
    await createAllergyIntolerance(medplum, { text: "Older" }, "2026-02-01");
    await createAllergyIntolerance(medplum, { text: "Peanuts" }, "2026-09-01");
    await createAllergyIntolerance(medplum, { text: "Latex" }, "2026-08-01");

    renderHealthProfile(medplum);

    expect(
      await screen.findByTestId("health-profile-active-allergies"),
    ).toHaveTextContent("Penicillin, Peanuts, Latex and 2 more");
  });

  it("names undated active allergies after every dated one, as the Allergies tab lists them", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    await createAllergyIntolerance(medplum, { text: "Undated" }, undefined);
    await createAllergyIntolerance(
      medplum,
      { text: "Penicillin" },
      "2026-10-01",
    );
    await createAllergyIntolerance(medplum, { text: "Peanuts" }, "2026-09-01");
    await createAllergyIntolerance(medplum, { text: "Latex" }, "2026-01-01");

    renderHealthProfile(medplum);

    expect(
      await screen.findByTestId("health-profile-active-allergies"),
    ).toHaveTextContent("Penicillin, Peanuts, Latex and 1 more");
  });

  it("names an undated active allergy when fewer than three are dated", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    await createAllergyIntolerance(medplum, { text: "Undated" }, undefined);
    await createAllergyIntolerance(
      medplum,
      { text: "Penicillin" },
      "2026-10-01",
    );

    renderHealthProfile(medplum);

    expect(
      await screen.findByTestId("health-profile-active-allergies"),
    ).toHaveTextContent(/^Penicillin, Undated$/);
  });

  it("names an allergy coded several ways by its first named coding, and one with no name as an allergy", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    await createAllergyIntolerance(
      medplum,
      {
        coding: [
          { code: "91935009" },
          { code: "91935009", display: "Peanut allergy" },
          { code: "Z91.010" },
        ],
      },
      "2026-10-02",
    );
    await createAllergyIntolerance(medplum, undefined, "2026-10-01");

    renderHealthProfile(medplum);

    expect(
      await screen.findByTestId("health-profile-active-allergies"),
    ).toHaveTextContent("Peanut allergy, Allergy");
  });

  it("leaves out another patient's prescriptions and allergies", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    const rowan = createReference(await createAnotherPatient(medplum));
    await createMedicationRequest(
      medplum,
      "Cetirizine 10 mg tablet",
      "2026-10-20",
      { subject: rowan },
    );
    await createAllergyIntolerance(
      medplum,
      { text: "Penicillin" },
      "2026-10-20",
      { patient: rowan },
    );

    renderHealthProfile(medplum);

    expect(
      await screen.findByTestId("health-profile-active-prescriptions"),
    ).toHaveTextContent("No active prescriptions");
    expect(
      await screen.findByTestId("health-profile-active-allergies"),
    ).toHaveTextContent("Not yet recorded");
  });

  it("asks Medplum, without its cache, for the active orders' doNotPerform only, and for the newest dated and undated active allergies", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    await createAllergyIntolerance(
      medplum,
      { text: "Penicillin" },
      "2026-10-20",
    );
    const search = vi.spyOn(medplum, "search");

    renderHealthProfile(medplum);
    await screen.findByTestId("health-profile-active-allergies");
    await screen.findByTestId("health-profile-active-prescriptions");

    expect(listSearches(search, RESOURCE_TYPE.MEDICATION_REQUEST)).toEqual([
      expect.objectContaining({
        fields: [MEDICATION_REQUEST_ELEMENT.DO_NOT_PERFORM],
        filters: sortFilters([
          patientFilter,
          {
            code: SEARCH_PARAMETER.INTENT,
            operator: Operator.EQUALS,
            value: [
              MEDICATION_REQUEST_INTENT.ORDER,
              MEDICATION_REQUEST_INTENT.ORIGINAL_ORDER,
              MEDICATION_REQUEST_INTENT.REFLEX_ORDER,
            ].join(SEARCH_VALUE_SEPARATOR),
          },
          {
            code: SEARCH_PARAMETER.STATUS,
            operator: Operator.EQUALS,
            value: MEDICATION_REQUEST_STATUS.ACTIVE,
          },
        ]),
      }),
    ]);
    expect(listSearches(search, RESOURCE_TYPE.ALLERGY_INTOLERANCE)).toEqual([
      activeAllergySearch(true),
      activeAllergySearch(false),
    ]);
  });

  it("asks whether any allergy is recorded only when none is active", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    const search = vi.spyOn(medplum, "search");

    renderHealthProfile(medplum);
    await screen.findByTestId("health-profile-active-allergies");

    expect(listSearches(search, RESOURCE_TYPE.ALLERGY_INTOLERANCE)).toEqual([
      activeAllergySearch(true),
      activeAllergySearch(false),
      recordedAllergyCount,
    ]);
  });

  it("shows an error and marks every row when the record cannot be read", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    failSearchesMatching(medplum, () => true);

    renderHealthProfile(medplum);

    expect(await screen.findByTestId("health-profile-error")).toHaveTextContent(
      constant.DEFAULT_ERROR_MESSAGE,
    );
    for (const testIdentifier of ROW_TEST_IDENTIFIERS) {
      expect(
        await screen.findByTestId(`${testIdentifier}-unavailable`),
      ).toHaveTextContent("Could not load");
    }
  });

  it.each([
    [RESOURCE_TYPE.CARE_PLAN, "health-profile-active-care-plans"],
    [RESOURCE_TYPE.MEDICATION_REQUEST, "health-profile-active-prescriptions"],
    [RESOURCE_TYPE.ALLERGY_INTOLERANCE, "health-profile-active-allergies"],
  ])(
    "keeps the other rows when %s cannot be read",
    async (failingResourceType, failingTestIdentifier) => {
      const medplum = new MockClient({ profile: HomerSimpson });
      failSearchesMatching(medplum, isSearchOf(failingResourceType));

      renderHealthProfile(medplum);

      expect(
        await screen.findByTestId("health-profile-error"),
      ).toBeInTheDocument();
      expect(
        await screen.findByTestId(`${failingTestIdentifier}-unavailable`),
      ).toBeInTheDocument();
      for (const testIdentifier of ROW_TEST_IDENTIFIERS.filter(
        (identifier) => identifier !== failingTestIdentifier,
      )) {
        expect(await screen.findByTestId(testIdentifier)).toBeInTheDocument();
      }
    },
  );

  it.each([
    ["the newest dated active allergies", isActiveAllergySearch(true)],
    ["the undated active allergies", isActiveAllergySearch(false)],
    ["whether any allergy is recorded", isRecordedAllergyCount],
  ])(
    "marks the allergy row as unavailable when only the search for %s fails",
    async (_, isFailingSearch) => {
      const medplum = new MockClient({ profile: HomerSimpson });
      const search = failSearchesMatching(medplum, isFailingSearch);

      renderHealthProfile(medplum);

      expect(
        await screen.findByTestId(
          "health-profile-active-allergies-unavailable",
        ),
      ).toHaveTextContent("Could not load");
      expect(
        await screen.findByTestId("health-profile-error"),
      ).toHaveTextContent(constant.DEFAULT_ERROR_MESSAGE);
      expect(
        search.mock.calls.some(([resourceType, query]) =>
          isFailingSearch(parseSearchQuery(resourceType, query)),
        ),
      ).toBe(true);
      expect(
        screen.getByTestId("health-profile-active-care-plans"),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("health-profile-active-prescriptions"),
      ).toBeInTheDocument();
    },
  );

  it("marks the prescription row as unavailable when a later page of active orders cannot be read", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    await createMedicationRequest(
      medplum,
      "Cetirizine 10 mg tablet",
      "2026-10-20",
    );
    await createMedicationRequest(
      medplum,
      "Cetirizine 10 mg tablet",
      "2026-10-20",
    );
    answerOneRecordPerPage(medplum, RESOURCE_TYPE.MEDICATION_REQUEST, 1);

    renderHealthProfile(medplum);

    expect(
      await screen.findByTestId(
        "health-profile-active-prescriptions-unavailable",
      ),
    ).toHaveTextContent("Could not load");
    expect(await screen.findByTestId("health-profile-error")).toHaveTextContent(
      constant.DEFAULT_ERROR_MESSAGE,
    );
  });

  it.each([
    [RESOURCE_TYPE.CARE_PLAN, "health-profile-active-care-plans"],
    [RESOURCE_TYPE.ALLERGY_INTOLERANCE, "health-profile-active-allergies"],
  ])(
    "marks a row as unavailable when Medplum answers the %s search without a total",
    async (answeredResourceType, answeredTestIdentifier) => {
      const medplum = new MockClient({ profile: HomerSimpson });
      interceptSearches(medplum, async (search, resourceType) => {
        const bundle = await search();
        return resourceType === answeredResourceType
          ? { ...bundle, total: undefined }
          : bundle;
      });

      renderHealthProfile(medplum);

      expect(
        await screen.findByTestId(`${answeredTestIdentifier}-unavailable`),
      ).toHaveTextContent("Could not load");
      expect(
        await screen.findByTestId("health-profile-error"),
      ).toHaveTextContent(constant.DEFAULT_ERROR_MESSAGE);
    },
  );

  it("reads the record again when the patient chooses to try again", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    await createAllergyIntolerance(
      medplum,
      { text: "Penicillin" },
      "2026-10-20",
    );
    let isRecordReachable = false;
    failSearchesMatching(medplum, () => !isRecordReachable);

    renderHealthProfile(medplum);
    const retry = await screen.findByTestId("health-profile-retry");
    isRecordReachable = true;
    await user.click(within(retry).getByRole("button"));

    expect(
      await screen.findByTestId("health-profile-active-allergies"),
    ).toHaveTextContent("Penicillin");
    expect(
      screen.getByTestId("health-profile-active-care-plans"),
    ).toHaveTextContent("No ongoing plans");
    expect(
      screen.getByTestId("health-profile-active-prescriptions"),
    ).toHaveTextContent("No active prescriptions");
    expect(
      screen.queryByTestId("health-profile-error"),
    ).not.toBeInTheDocument();
  });

  it("reads again only the rows that could not be read", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    await createAllergyIntolerance(
      medplum,
      { text: "Penicillin" },
      "2026-10-20",
    );
    let isAllergyReachable = false;
    const search = failSearchesMatching(
      medplum,
      (searchRequest) =>
        isSearchOf(RESOURCE_TYPE.ALLERGY_INTOLERANCE)(searchRequest) &&
        !isAllergyReachable,
    );

    renderHealthProfile(medplum);
    const retry = await screen.findByTestId("health-profile-retry");
    await screen.findByTestId("health-profile-active-care-plans");
    await screen.findByTestId("health-profile-active-prescriptions");
    search.mockClear();
    isAllergyReachable = true;
    await user.click(within(retry).getByRole("button"));

    expect(
      await screen.findByTestId("health-profile-active-allergies"),
    ).toHaveTextContent("Penicillin");
    expect(
      new Set(search.mock.calls.map(([resourceType]) => resourceType)),
    ).toEqual(new Set([RESOURCE_TYPE.ALLERGY_INTOLERANCE]));
  });

  it("links Medications and Allergies to their lists, named for screen readers, and leaves Current treatment without a link", async () => {
    renderHealthProfile(new MockClient({ profile: HomerSimpson }));

    const medicationsLink = await screen.findByTestId(
      "health-profile-active-prescriptions-link",
    );
    expect(medicationsLink).toHaveRole("link");
    expect(medicationsLink).toHaveAccessibleName("View medications");
    expect(medicationsLink).toHaveTextContent("View");
    expect(medicationsLink).toHaveAttribute("href", routes.MEDICATIONS);
    const allergiesLink = screen.getByTestId(
      "health-profile-active-allergies-link",
    );
    expect(allergiesLink).toHaveAccessibleName("View allergies");
    expect(allergiesLink).toHaveAttribute(
      "href",
      "/health-records?tab=allergies",
    );
    expect(
      screen.queryByTestId("health-profile-active-care-plans-link"),
    ).not.toBeInTheDocument();
  });

  it("links each kind of health history to its Health records tab, in the tabs' order", async () => {
    renderHealthProfile(new MockClient({ profile: HomerSimpson }));

    const healthHistory = await screen.findByTestId("health-history");
    expect(
      Array.from(healthHistory.children, ({ textContent }) => textContent),
    ).toEqual(["Conditions", "Allergies", "Measurements"]);
    for (const tabKey of ["conditions", "allergies", "measurements"]) {
      const link = within(healthHistory).getByTestId(
        `health-history-${tabKey}`,
      );
      expect(link).toHaveRole("link");
      expect(link).toHaveAttribute("href", `/health-records?tab=${tabKey}`);
    }
    expect(
      await screen.findByTestId("health-profile-active-allergies"),
    ).toBeInTheDocument();
  });
});
