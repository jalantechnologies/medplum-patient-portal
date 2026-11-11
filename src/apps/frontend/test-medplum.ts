import { createReference } from "@medplum/core";
import type { Appointment, Bundle, CarePlan } from "@medplum/fhirtypes";
import { HomerSimpson, type MockClient } from "@medplum/mock";
import { vi } from "vitest";

import {
  APPOINTMENT_PARTICIPANT_STATUS,
  CARE_PLAN_INTENT,
  RESOURCE_TYPE,
} from "./constants/fhir";

export const createAppointment = (
  medplum: MockClient,
  status: Appointment["status"],
  start: Date,
): Promise<Appointment> =>
  medplum.createResource<Appointment>({
    resourceType: RESOURCE_TYPE.APPOINTMENT,
    status,
    start: start.toISOString(),
    end: new Date(start.getTime() + 30 * 60 * 1000).toISOString(),
    participant: [
      {
        actor: createReference(HomerSimpson),
        status: APPOINTMENT_PARTICIPANT_STATUS.ACCEPTED,
      },
    ],
  });

export const createCarePlan = (
  medplum: MockClient,
  status: CarePlan["status"],
): Promise<CarePlan> =>
  medplum.createResource<CarePlan>({
    resourceType: RESOURCE_TYPE.CARE_PLAN,
    status,
    intent: CARE_PLAN_INTENT.PLAN,
    subject: createReference(HomerSimpson),
  });

export const interceptSearches = (
  medplum: MockClient,
  intercept: (
    search: () => Promise<Bundle>,
    resourceType: string,
  ) => Promise<Bundle>,
) => {
  const search = medplum.search.bind(medplum);
  vi.spyOn(medplum, "search").mockImplementation(((
    resourceType,
    query,
    options,
  ) =>
    intercept(
      () => search(resourceType, query, options),
      resourceType,
    )) as typeof medplum.search);
};
