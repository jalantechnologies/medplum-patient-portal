import { createReference } from "@medplum/core";
import type { Bundle, CarePlan } from "@medplum/fhirtypes";
import { HomerSimpson, type MockClient } from "@medplum/mock";
import { vi } from "vitest";

import { CARE_PLAN_INTENT, RESOURCE_TYPE } from "./constants/fhir";

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
