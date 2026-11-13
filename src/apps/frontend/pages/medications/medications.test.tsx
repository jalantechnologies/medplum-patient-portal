import {
  createReference,
  getSearchParameter,
  Operator,
  parseSearchRequest,
  type Filter,
  type SearchRequest,
} from "@medplum/core";
import type { MedicationRequest, Patient } from "@medplum/fhirtypes";
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
  describe,
  expect,
  it,
  onTestFinished,
  vi,
  type MockInstance,
} from "vitest";

import constant from "../../constants";
import {
  MEDICATION_REQUEST_INTENT,
  MEDICATION_REQUEST_STATUS,
  RESOURCE_TYPE,
  SEARCH_PARAMETER,
  SEARCH_VALUE_SEPARATOR,
  TIMING_PERIOD_UNIT,
} from "../../constants/fhir";
import { MedicationRequestProvider } from "../../providers";
import { createMedicationRequest } from "../../test-medplum";
import { TestProviders } from "../../test-providers";
import Medications from "./medications.page";

const homer = createReference(HomerSimpson);
const ALL_MEDICATIONS = "all-medications";
const PAST_MEDICATIONS = "past-medications";

const renderMedications = (medplum: MockClient) =>
  render(
    <TestProviders medplum={medplum}>
      <MedicationRequestProvider>
        <Medications />
      </MedicationRequestProvider>
    </TestProviders>,
  );

const showDatesInChicago = () => {
  vi.stubEnv("TZ", "America/Chicago");
  onTestFinished(() => {
    vi.unstubAllEnvs();
  });
};

const failSearches = (medplum: MockClient, shouldFail: () => boolean) => {
  const searchResources = medplum.searchResources.bind(medplum);
  return vi
    .spyOn(medplum, "searchResources")
    .mockImplementation(((resourceType, query, options) =>
      shouldFail()
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

const listMedicationTitles = (container: HTMLElement, tabKey: string) =>
  within(container)
    .getAllByTestId(`${tabKey}-record`)
    .map((card) => within(card).getByRole("heading", { level: 2 }).textContent);

const parseSearchRequests = (
  searchResources: MockInstance<MockClient["searchResources"]>,
) =>
  searchResources.mock.calls.map(([resourceType, query]) =>
    parseSearchRequest(`${resourceType}${String(query)}`),
  );

const findFilterValue = ({ filters }: SearchRequest, code: string) =>
  filters?.find((filter) => filter.code === code)?.value;

const listMedicationTexts = (container: HTMLElement, tabKey: string) =>
  within(container)
    .getAllByTestId(`${tabKey}-record`)
    .map((card) => card.textContent);

describe("Medications", () => {
  it("shows whose record it is, the title, and a tab for all and for past medications with all open", async () => {
    renderMedications(new MockClient({ profile: HomerSimpson }));

    expect(screen.getByTestId("medications-record-owner")).toHaveTextContent(
      "Your record · Homer Simpson",
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Medications" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "All medications",
      "Past medications",
    ]);
    expect(screen.getByTestId(`${ALL_MEDICATIONS}-tab`)).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      await screen.findByTestId(`${ALL_MEDICATIONS}-empty`),
    ).toBeInTheDocument();
  });

  it("shows loading until the prescriptions arrive", async () => {
    renderMedications(new MockClient({ profile: HomerSimpson }));

    expect(screen.getByTestId(`${ALL_MEDICATIONS}-loading`)).toHaveTextContent(
      "Loading…",
    );
    expect(
      await screen.findByTestId(`${ALL_MEDICATIONS}-empty`),
    ).toBeInTheDocument();
  });

  it("lists the patient's prescriptions newest first, each with who prescribed it, its status, how to take it and when it was prescribed", async () => {
    showDatesInChicago();
    const medplum = new MockClient({ profile: HomerSimpson });
    await createMedicationRequest(
      medplum,
      "Amlodipine 5 mg tablet",
      "2025-05-14",
      {
        status: MEDICATION_REQUEST_STATUS.STOPPED,
        dosageInstruction: [{ text: "One tablet daily." }],
      },
    );
    await createMedicationRequest(
      medplum,
      "Triamcinolone 0.1% cream",
      "2026-10-20T22:30:00-05:00",
      {
        dosageInstruction: [
          {
            text: "Apply BID x 14 days",
            patientInstruction:
              "Apply a thin layer to affected skin twice daily for up to 14 days.",
          },
        ],
      },
    );

    renderMedications(medplum);

    const list = await screen.findByTestId(`${ALL_MEDICATIONS}-list`);
    expect(listMedicationTexts(list, ALL_MEDICATIONS)).toEqual([
      "Triamcinolone 0.1% creamDr. Mira SyntheticActiveApply a thin layer to affected skin twice daily for up to 14 days.PrescribedOctober 20, 2026",
      "Amlodipine 5 mg tabletDr. Mira SyntheticStoppedOne tablet daily.PrescribedMay 14, 2025",
    ]);
    expect(list.tagName).toBe("UL");
    expect(
      within(list).getAllByTestId(`${ALL_MEDICATIONS}-record`)[0].tagName,
    ).toBe("LI");
  });

  it("shows how much to take, how often and whether as needed when a prescription's instructions are coded", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    await createMedicationRequest(
      medplum,
      "Lisinopril 10 mg tablet",
      "2026-10-20",
      {
        dosageInstruction: [
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
        ],
      },
    );
    await createMedicationRequest(medplum, "Albuterol inhaler", "2026-10-19", {
      dosageInstruction: [{ sequence: 1, asNeededBoolean: true }],
    });
    await createMedicationRequest(
      medplum,
      "Triamcinolone 0.1% cream",
      "2026-10-18",
      { dosageInstruction: [{ timing: { code: { text: "Twice a day" } } }] },
    );

    renderMedications(medplum);

    const list = await screen.findByTestId(`${ALL_MEDICATIONS}-list`);
    expect(listMedicationTexts(list, ALL_MEDICATIONS)).toEqual([
      "Lisinopril 10 mg tabletDr. Mira SyntheticActiveDose: 1 · DailyPrescribedOctober 20, 2026",
      "Albuterol inhalerDr. Mira SyntheticActiveAs neededPrescribedOctober 19, 2026",
      "Triamcinolone 0.1% creamDr. Mira SyntheticActiveTwice a dayPrescribedOctober 18, 2026",
    ]);
  });

  it("lists prescriptions with no date after the dated ones", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    await createMedicationRequest(
      medplum,
      "Hydrocortisone 1% cream",
      "2025-05-14",
    );
    await createMedicationRequest(medplum, "Childhood inhaler", undefined);
    await createMedicationRequest(
      medplum,
      "Triamcinolone 0.1% cream",
      "2026-10-20",
    );

    renderMedications(medplum);

    const list = await screen.findByTestId(`${ALL_MEDICATIONS}-list`);
    expect(listMedicationTitles(list, ALL_MEDICATIONS)).toEqual([
      "Triamcinolone 0.1% cream",
      "Hydrocortisone 1% cream",
      "Childhood inhaler",
    ]);
  });

  it("shows only the signed-in patient's prescriptions", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    const otherPatient = await medplum.createResource<Patient>({
      resourceType: RESOURCE_TYPE.PATIENT,
      name: [{ given: ["Harper"], family: "Synthetic" }],
    });
    await createMedicationRequest(
      medplum,
      "Another patient's inhaler",
      "2026-10-21",
      { subject: createReference(otherPatient) },
    );
    await createMedicationRequest(
      medplum,
      "Triamcinolone 0.1% cream",
      "2026-10-20",
    );

    renderMedications(medplum);

    const list = await screen.findByTestId(`${ALL_MEDICATIONS}-list`);
    expect(listMedicationTitles(list, ALL_MEDICATIONS)).toEqual([
      "Triamcinolone 0.1% cream",
    ]);
  });

  it("lists completed and stopped prescriptions under past medications, and cancelled ones only under all medications", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    await createMedicationRequest(medplum, "Active cream", "2026-10-20");
    await createMedicationRequest(medplum, "Paused tablet", "2026-10-19", {
      status: MEDICATION_REQUEST_STATUS.ON_HOLD,
    });
    await createMedicationRequest(medplum, "Finished course", "2026-10-18", {
      status: MEDICATION_REQUEST_STATUS.COMPLETED,
    });
    await createMedicationRequest(medplum, "Stopped tablet", "2026-10-17", {
      status: MEDICATION_REQUEST_STATUS.STOPPED,
    });
    await createMedicationRequest(
      medplum,
      "Withdrawn prescription",
      "2026-10-16",
      {
        status: MEDICATION_REQUEST_STATUS.CANCELLED,
      },
    );

    renderMedications(medplum);
    expect(
      listMedicationTitles(
        await screen.findByTestId(`${ALL_MEDICATIONS}-list`),
        ALL_MEDICATIONS,
      ),
    ).toEqual([
      "Active cream",
      "Paused tablet",
      "Finished course",
      "Stopped tablet",
      "Withdrawn prescription",
    ]);
    const panel = await openTab(user, PAST_MEDICATIONS);

    expect(
      listMedicationTitles(
        await within(panel).findByTestId(`${PAST_MEDICATIONS}-list`),
        PAST_MEDICATIONS,
      ),
    ).toEqual(["Finished course", "Stopped tablet"]);
  });

  it("leaves out drafts and prescriptions entered in error", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    await createMedicationRequest(
      medplum,
      "Triamcinolone 0.1% cream",
      "2026-10-20",
    );
    await createMedicationRequest(
      medplum,
      "Warfarin, entered by mistake",
      "2026-10-21",
      { status: MEDICATION_REQUEST_STATUS.ENTERED_IN_ERROR },
    );
    await createMedicationRequest(
      medplum,
      "Unsigned cetirizine",
      "2026-10-22",
      {
        status: MEDICATION_REQUEST_STATUS.DRAFT,
      },
    );

    renderMedications(medplum);

    const list = await screen.findByTestId(`${ALL_MEDICATIONS}-list`);
    expect(listMedicationTitles(list, ALL_MEDICATIONS)).toEqual([
      "Triamcinolone 0.1% cream",
    ]);
  });

  it("lists only orders, not proposals, plans, options, or the pharmacy's or a single dose's copy of an order", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    for (const intent of Object.values(MEDICATION_REQUEST_INTENT)) {
      await createMedicationRequest(medplum, intent, "2026-10-20", { intent });
    }

    renderMedications(medplum);

    const list = await screen.findByTestId(`${ALL_MEDICATIONS}-list`);
    expect(listMedicationTitles(list, ALL_MEDICATIONS).toSorted()).toEqual(
      [
        MEDICATION_REQUEST_INTENT.ORDER,
        MEDICATION_REQUEST_INTENT.ORIGINAL_ORDER,
        MEDICATION_REQUEST_INTENT.REFLEX_ORDER,
      ].toSorted(),
    );
  });

  it("marks an order not to take a medicine, and says when it was recorded rather than prescribed", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    await createMedicationRequest(medplum, "Warfarin", "2026-10-20", {
      doNotPerform: true,
    });

    renderMedications(medplum);

    const list = await screen.findByTestId(`${ALL_MEDICATIONS}-list`);
    expect(listMedicationTexts(list, ALL_MEDICATIONS)).toEqual([
      "WarfarinDr. Mira SyntheticDo not takeActiveRecordedOctober 20, 2026",
    ]);
  });

  it("says so when a tab has nothing in it", async () => {
    const user = userEvent.setup();
    renderMedications(new MockClient({ profile: HomerSimpson }));

    expect(
      await screen.findByTestId(`${ALL_MEDICATIONS}-empty`),
    ).toHaveTextContent(
      "No medication records availableA missing medicine record does not confirm that you take no medicines.",
    );
    expect(
      await within(await openTab(user, PAST_MEDICATIONS)).findByTestId(
        `${PAST_MEDICATIONS}-empty`,
      ),
    ).toHaveTextContent(
      "No past medicines availableA missing medicine record does not confirm that you take no medicines.",
    );
  });

  it("shows the newest page of prescriptions first, and the older ones when the patient asks for more", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    const prescriptionCount = constant.SEARCH_PAGE_SIZE + 1;
    for (let index = 0; index < prescriptionCount; index += 1) {
      await createMedicationRequest(
        medplum,
        `Prescription ${index + 1}`,
        new Date(Date.UTC(2020, 0, 1 + index)).toISOString().slice(0, 10),
      );
    }

    renderMedications(medplum);

    const list = await screen.findByTestId(`${ALL_MEDICATIONS}-list`);
    expect(
      within(list).getAllByTestId(`${ALL_MEDICATIONS}-record`),
    ).toHaveLength(constant.SEARCH_PAGE_SIZE);
    await user.click(screen.getByTestId(`${ALL_MEDICATIONS}-more`));

    await waitFor(() =>
      expect(
        within(list).getAllByTestId(`${ALL_MEDICATIONS}-record`),
      ).toHaveLength(prescriptionCount),
    );
    expect(listMedicationTitles(list, ALL_MEDICATIONS).at(-1)).toBe(
      "Prescription 1",
    );
    expect(
      screen.queryByTestId(`${ALL_MEDICATIONS}-more`),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId(`${ALL_MEDICATIONS}-status`).textContent).toBe(
      `${prescriptionCount} records shown`,
    );
  });

  it("shows an error and marks the tab that could not be read", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    failSearches(medplum, () => true);

    renderMedications(medplum);

    expect(await screen.findByTestId("medications-error")).toHaveTextContent(
      constant.DEFAULT_ERROR_MESSAGE,
    );
    expect(
      screen.getByTestId(`${ALL_MEDICATIONS}-unavailable`),
    ).toHaveTextContent("Could not load");
  });

  it("reads the prescriptions again when the patient chooses to try again", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    await createMedicationRequest(
      medplum,
      "Triamcinolone 0.1% cream",
      "2026-10-20",
    );
    let isRecordReachable = false;
    failSearches(medplum, () => !isRecordReachable);

    renderMedications(medplum);
    const error = await screen.findByTestId("medications-error");
    isRecordReachable = true;
    await user.click(within(error).getByRole("button"));

    const list = await screen.findByTestId(`${ALL_MEDICATIONS}-list`);
    expect(listMedicationTitles(list, ALL_MEDICATIONS)).toEqual([
      "Triamcinolone 0.1% cream",
    ]);
    expect(screen.queryByTestId("medications-error")).not.toBeInTheDocument();
  });

  it("reads past prescriptions only once their tab is opened", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    const searchResources = vi.spyOn(medplum, "searchResources");

    const listSearchedStatuses = () => [
      ...new Set(
        parseSearchRequests(searchResources).map((searchRequest) =>
          findFilterValue(searchRequest, SEARCH_PARAMETER.STATUS),
        ),
      ),
    ];

    renderMedications(medplum);
    await screen.findByTestId(`${ALL_MEDICATIONS}-empty`);
    expect(listSearchedStatuses()).toHaveLength(1);

    await within(await openTab(user, PAST_MEDICATIONS)).findByTestId(
      `${PAST_MEDICATIONS}-empty`,
    );
    await openTab(user, ALL_MEDICATIONS);
    expect(listSearchedStatuses()).toHaveLength(2);
  });

  it("asks Medplum without its cache, for each tab's orders and statuses, the dated ones newest first and then the undated ones, with only search parameters that prescriptions define", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    const searchResources = vi.spyOn(medplum, "searchResources");

    renderMedications(medplum);
    await screen.findByTestId(`${ALL_MEDICATIONS}-empty`);
    await within(await openTab(user, PAST_MEDICATIONS)).findByTestId(
      `${PAST_MEDICATIONS}-empty`,
    );

    for (const [resourceType, , options] of searchResources.mock.calls) {
      expect(resourceType).toBe(RESOURCE_TYPE.MEDICATION_REQUEST);
      expect(options).toEqual(expect.objectContaining({ cache: "reload" }));
    }
    const searchedFor = (
      statuses: MedicationRequest["status"][],
      hasDate: boolean,
    ) => ({
      filters: expect.arrayContaining<Filter>([
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
          value: statuses.join(SEARCH_VALUE_SEPARATOR),
        },
        {
          code: SEARCH_PARAMETER.AUTHORED_ON,
          operator: Operator.MISSING,
          value: String(!hasDate),
        },
      ]),
      sortRules: hasDate
        ? [{ code: SEARCH_PARAMETER.AUTHORED_ON, descending: true }]
        : [{ code: SEARCH_PARAMETER.ID, descending: false }],
    });
    const listedStatuses = [
      MEDICATION_REQUEST_STATUS.ACTIVE,
      MEDICATION_REQUEST_STATUS.ON_HOLD,
      MEDICATION_REQUEST_STATUS.COMPLETED,
      MEDICATION_REQUEST_STATUS.STOPPED,
      MEDICATION_REQUEST_STATUS.CANCELLED,
      MEDICATION_REQUEST_STATUS.UNKNOWN,
    ];
    const pastStatuses = [
      MEDICATION_REQUEST_STATUS.COMPLETED,
      MEDICATION_REQUEST_STATUS.STOPPED,
    ];
    const searchRequests = parseSearchRequests(searchResources);
    expect(searchRequests).toEqual([
      expect.objectContaining(searchedFor(listedStatuses, true)),
      expect.objectContaining(searchedFor(listedStatuses, false)),
      expect.objectContaining(searchedFor(pastStatuses, true)),
      expect.objectContaining(searchedFor(pastStatuses, false)),
    ]);
    for (const searchRequest of searchRequests) {
      expect(searchRequest.filters).toHaveLength(4);
      expect(findFilterValue(searchRequest, SEARCH_PARAMETER.PATIENT)).toBe(
        homer.reference,
      );
      for (const { code } of [
        ...(searchRequest.filters ?? []),
        ...(searchRequest.sortRules ?? []),
      ]) {
        expect(
          getSearchParameter(RESOURCE_TYPE.MEDICATION_REQUEST, code),
          code,
        ).toBeDefined();
      }
    }
  });

  it("moves between the tabs with the arrow keys", async () => {
    const user = userEvent.setup();
    renderMedications(new MockClient({ profile: HomerSimpson }));

    await screen.findByTestId(`${ALL_MEDICATIONS}-empty`);
    await user.click(screen.getByTestId(`${ALL_MEDICATIONS}-tab`));
    // Base Web reads the deprecated keyCode, which user-event leaves at 0; browsers set it.
    fireEvent.keyDown(screen.getByTestId(`${ALL_MEDICATIONS}-tab`), {
      key: "ArrowRight",
      keyCode: 39,
    });

    expect(screen.getByTestId(`${PAST_MEDICATIONS}-tab`)).toHaveFocus();
    expect(screen.getByTestId(`${PAST_MEDICATIONS}-tab`)).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("tells a screen reader how many prescriptions arrived, without reading them out", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    await createMedicationRequest(
      medplum,
      "Triamcinolone 0.1% cream",
      "2026-10-20",
    );

    renderMedications(medplum);

    const status = screen.getByTestId(`${ALL_MEDICATIONS}-status`);
    expect(status).toHaveAttribute("role", "status");
    expect(status).toHaveTextContent("Loading…");
    const list = await screen.findByTestId(`${ALL_MEDICATIONS}-list`);
    expect(screen.getByTestId(`${ALL_MEDICATIONS}-status`)).toBe(status);
    expect(status.textContent).toBe("1 record shown");
    expect(status).not.toContainElement(list);
    expect(list).toBeVisible();
  });
});
