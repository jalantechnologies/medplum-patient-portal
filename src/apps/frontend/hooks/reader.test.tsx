import { createReference, getReferenceString } from "@medplum/core";
import { HomerSimpson, MockClient } from "@medplum/mock";
import { act, render, waitFor } from "@testing-library/react";
import { useEffect, type FC, type PropsWithChildren } from "react";
import { describe, expect, it } from "vitest";

import {
  APPOINTMENT_STATUS,
  CARE_PLAN_STATUS,
  RESOURCE_TYPE,
} from "../constants/fhir";
import { useAppointmentContext, useCarePlanContext } from "../contexts";
import { AppointmentProvider, CarePlanProvider } from "../providers";
import {
  createAppointment,
  createCarePlan,
  interceptSearches,
} from "../test-medplum";
import { TestProviders } from "../test-providers";
import { AsynchronousOperationError, type Nullable } from "../types";

interface Reading {
  answer: unknown;
  error: Nullable<AsynchronousOperationError>;
  isLoading: boolean;
  load: (patientReference: string) => Promise<unknown>;
  value: object;
}

interface PageRender {
  answer: unknown;
  hasFailed: boolean;
  isLoading: boolean;
  page: string;
  value: object;
}

interface ReadContext {
  contextName: string;
  createAnswer: (medplum: MockClient) => Promise<unknown>;
  emptyAnswer: unknown;
  Provider: FC<PropsWithChildren>;
  resourceType: string;
  useReading: () => Reading;
}

const patientReference = getReferenceString(createReference(HomerSimpson));

const useCarePlanReading = (): Reading => {
  const carePlan = useCarePlanContext();
  return {
    answer: carePlan.activeCarePlanCount,
    error: carePlan.activeCarePlanCountError,
    isLoading: carePlan.isActiveCarePlanCountLoading,
    load: carePlan.countActiveCarePlans,
    value: carePlan,
  };
};

const useAppointmentReading = (): Reading => {
  const appointment = useAppointmentContext();
  return {
    answer: appointment.nextAppointment?.id ?? null,
    error: appointment.nextAppointmentError,
    isLoading: appointment.isNextAppointmentLoading,
    load: appointment.getNextAppointment,
    value: appointment,
  };
};

const tomorrow = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date;
};

const readContexts: ReadContext[] = [
  {
    contextName: "useCarePlanContext",
    createAnswer: async (medplum) => {
      await createCarePlan(medplum, CARE_PLAN_STATUS.ACTIVE);
      return 1;
    },
    emptyAnswer: 0,
    Provider: CarePlanProvider,
    resourceType: RESOURCE_TYPE.CARE_PLAN,
    useReading: useCarePlanReading,
  },
  {
    contextName: "useAppointmentContext",
    createAnswer: async (medplum) => {
      const appointment = await createAppointment(
        medplum,
        APPOINTMENT_STATUS.BOOKED,
        tomorrow(),
      );
      return appointment.id;
    },
    emptyAnswer: null,
    Provider: AppointmentProvider,
    resourceType: RESOURCE_TYPE.APPOINTMENT,
    useReading: useAppointmentReading,
  },
];

const renderPages = (
  medplum: MockClient,
  { Provider, useReading }: ReadContext,
  pages: string[],
) => {
  const renders: PageRender[] = [];
  const ReadingPage: FC<{ page: string }> = ({ page }) => {
    const { answer, error, isLoading, load, value } = useReading();
    renders.push({ answer, hasFailed: error !== null, isLoading, page, value });
    useEffect(() => {
      void Promise.allSettled([load(patientReference)]);
    }, [load]);
    return null;
  };
  const tree = (shownPages: string[]) => (
    <TestProviders medplum={medplum}>
      <Provider>
        {shownPages.map((page) => (
          <ReadingPage key={page} page={page} />
        ))}
      </Provider>
    </TestProviders>
  );
  const { rerender } = render(tree(pages));
  const rendersOf = (page: string) =>
    renders.filter((pageRender) => pageRender.page === page);
  return {
    lastRenderOf: (page: string) => rendersOf(page).at(-1),
    openPages: (...shownPages: string[]) =>
      act(() => rerender(tree(shownPages))),
    rendersOf,
  };
};

const failSearchesWhile = (
  medplum: MockClient,
  resourceType: string,
  isUnreachable: () => boolean,
  createFailure: () => unknown = () => new TypeError("Failed to fetch"),
) =>
  interceptSearches(medplum, (search, searchedResourceType) =>
    searchedResourceType === resourceType && isUnreachable()
      ? Promise.reject(createFailure())
      : search(),
  );

describe.each(readContexts)("$contextName", (readContext) => {
  it("shows a page none of the failure the page before it left behind, from its first render, and loading until its own answer", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    let isUnreachable = true;
    failSearchesWhile(medplum, readContext.resourceType, () => isUnreachable);
    const { lastRenderOf, openPages, rendersOf } = renderPages(
      medplum,
      readContext,
      ["first"],
    );
    await waitFor(() => expect(lastRenderOf("first")?.hasFailed).toBe(true));
    isUnreachable = false;

    await openPages("second");
    await waitFor(() =>
      expect(lastRenderOf("second")).toMatchObject({
        answer: readContext.emptyAnswer,
        isLoading: false,
      }),
    );

    expect(rendersOf("second")[0]).toMatchObject({ isLoading: true });
    expect(rendersOf("second").some(({ hasFailed }) => hasFailed)).toBe(false);
  });

  it("shows a page the failure of its own request after it arrived to an earlier one", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    failSearchesWhile(medplum, readContext.resourceType, () => true);
    const { lastRenderOf, openPages } = renderPages(medplum, readContext, [
      "first",
    ]);
    await waitFor(() => expect(lastRenderOf("first")?.hasFailed).toBe(true));

    await openPages("second");

    await waitFor(() =>
      expect(lastRenderOf("second")).toMatchObject({
        hasFailed: true,
        isLoading: false,
      }),
    );
  });

  it("shows a page the failure of its own request when it fails with the very error the earlier one failed with", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    const failure = new AsynchronousOperationError("Medplum is unreachable");
    failSearchesWhile(
      medplum,
      readContext.resourceType,
      () => true,
      () => failure,
    );
    const { lastRenderOf, openPages } = renderPages(medplum, readContext, [
      "first",
    ]);
    await waitFor(() => expect(lastRenderOf("first")?.hasFailed).toBe(true));

    await openPages("second");

    await waitFor(() =>
      expect(lastRenderOf("second")).toMatchObject({
        hasFailed: true,
        isLoading: false,
      }),
    );
  });

  it("keeps the last answer, without loading, for a page that arrives to a failure", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    const answer = await readContext.createAnswer(medplum);
    let isUnreachable = false;
    failSearchesWhile(medplum, readContext.resourceType, () => isUnreachable);
    const { lastRenderOf, openPages, rendersOf } = renderPages(
      medplum,
      readContext,
      ["first"],
    );
    await waitFor(() => expect(lastRenderOf("first")?.answer).toBe(answer));
    isUnreachable = true;
    await openPages("again");
    await waitFor(() => expect(lastRenderOf("again")?.hasFailed).toBe(true));

    await openPages("second");

    expect(rendersOf("second")[0]).toMatchObject({
      answer,
      hasFailed: false,
      isLoading: false,
    });
    await waitFor(() => expect(lastRenderOf("second")?.hasFailed).toBe(true));
  });

  it("keeps the failure on screen for a page that stays while another page that read it leaves", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    failSearchesWhile(medplum, readContext.resourceType, () => true);
    const { lastRenderOf, openPages, rendersOf } = renderPages(
      medplum,
      readContext,
      ["staying", "leaving"],
    );
    await waitFor(() => {
      expect(lastRenderOf("staying")?.hasFailed).toBe(true);
      expect(lastRenderOf("leaving")?.hasFailed).toBe(true);
    });
    const stayingRenderCount = rendersOf("staying").length;

    await openPages("staying");

    expect(rendersOf("staying").length).toBeGreaterThan(stayingRenderCount);
    expect(lastRenderOf("staying")).toMatchObject({
      hasFailed: true,
      isLoading: false,
    });
  });

  it("shows a page that opens beside another the failure of the request it asks for, as the other page does", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    failSearchesWhile(medplum, readContext.resourceType, () => true);
    const { lastRenderOf, openPages } = renderPages(medplum, readContext, [
      "first",
    ]);
    await waitFor(() => expect(lastRenderOf("first")?.hasFailed).toBe(true));

    await openPages("first", "beside");

    await waitFor(() =>
      expect(lastRenderOf("beside")).toMatchObject({
        hasFailed: true,
        isLoading: false,
      }),
    );
    expect(lastRenderOf("first")).toMatchObject({
      hasFailed: true,
      isLoading: false,
    });
  });

  it("gives a page the same reading on a render where nothing it reads has changed", async () => {
    const medplum = new MockClient({ profile: HomerSimpson });
    const { lastRenderOf, openPages, rendersOf } = renderPages(
      medplum,
      readContext,
      ["first"],
    );
    await waitFor(() =>
      expect(lastRenderOf("first")).toMatchObject({
        answer: readContext.emptyAnswer,
        isLoading: false,
      }),
    );

    await openPages("first");

    const [settledRender, nextRender] = rendersOf("first").slice(-2);
    expect(nextRender?.value).toBe(settledRender?.value);
  });
});
