import { createReference } from "@medplum/core";
import type { CarePlan } from "@medplum/fhirtypes";
import { HomerSimpson, MockClient } from "@medplum/mock";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import constant from "../../constants";
import {
  APPOINTMENT_STATUS,
  CARE_PLAN_INTENT,
  CARE_PLAN_STATUS,
  RESOURCE_TYPE,
} from "../../constants/fhir";
import { AppointmentProvider, CarePlanProvider } from "../../providers";
import { createAppointment, createCarePlan } from "../../test-medplum";
import { TestProviders } from "../../test-providers";
import Home from "./home.page";

const homeInsideProviders = (medplum: MockClient, isHomeShown = true) => (
  <TestProviders medplum={medplum}>
    <CarePlanProvider>
      <AppointmentProvider>{isHomeShown ? <Home /> : null}</AppointmentProvider>
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

  it("shows that a patient with an empty record has no ongoing plans and no visit booked", async () => {
    renderHome(new MockClient({ profile: HomerSimpson }));

    expect(await screen.findByTestId("active-care-plans")).toHaveTextContent(
      "No ongoing plans",
    );
    expect(screen.getByTestId("next-visit")).toHaveTextContent("None booked");
  });

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

  it("shows an error and marks both facts when the record cannot be read", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    failSearches(medplum, () => true);

    renderHome(medplum);

    expect(await screen.findByTestId("home-overview-error")).toHaveTextContent(
      constant.DEFAULT_ERROR_MESSAGE,
    );
    expect(
      screen.getByTestId("active-care-plans-unavailable"),
    ).toHaveTextContent("Could not load");
    expect(screen.getByTestId("next-visit-unavailable")).toHaveTextContent(
      "Could not load",
    );
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
    let isRecordReachable = false;
    failSearches(medplum, () => !isRecordReachable);

    renderHome(medplum);
    const error = await screen.findByTestId("home-overview-error");
    isRecordReachable = true;
    await user.click(within(error).getByRole("button"));

    expect(await screen.findByTestId("active-care-plans")).toHaveTextContent(
      "1 ongoing plan",
    );
    expect(screen.getByTestId("next-visit")).toHaveTextContent("None booked");
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
