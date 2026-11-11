import { createReference } from "@medplum/core";
import type {
  AllergyIntolerance,
  Appointment,
  Bundle,
  CarePlan,
  CodeableConcept,
  MedicationRequest,
} from "@medplum/fhirtypes";
import { HomerSimpson, type MockClient } from "@medplum/mock";
import { vi } from "vitest";

import {
  ALLERGY_INTOLERANCE_CLINICAL_STATUS,
  ALLERGY_INTOLERANCE_VERIFICATION_STATUS,
  APPOINTMENT_PARTICIPANT_STATUS,
  CARE_PLAN_INTENT,
  CODE_SYSTEM,
  MEDICATION_REQUEST_INTENT,
  MEDICATION_REQUEST_STATUS,
  RESOURCE_TYPE,
} from "./constants/fhir";

export const doctor = { display: "Dr. Mira Synthetic" };

export const networkFailure = () => new TypeError("Failed to fetch");

export const codeFrom = (system: string, code: string): CodeableConcept => ({
  coding: [{ system, code }],
});

export const createAllergyIntolerance = (
  medplum: MockClient,
  code: CodeableConcept | undefined,
  recordedDate: string | undefined,
  overrides: Partial<AllergyIntolerance> = {},
): Promise<AllergyIntolerance> =>
  medplum.createResource<AllergyIntolerance>({
    resourceType: RESOURCE_TYPE.ALLERGY_INTOLERANCE,
    patient: createReference(HomerSimpson),
    code,
    recordedDate,
    recorder: doctor,
    clinicalStatus: codeFrom(
      CODE_SYSTEM.ALLERGY_INTOLERANCE_CLINICAL,
      ALLERGY_INTOLERANCE_CLINICAL_STATUS.ACTIVE,
    ),
    verificationStatus: codeFrom(
      CODE_SYSTEM.ALLERGY_INTOLERANCE_VERIFICATION,
      ALLERGY_INTOLERANCE_VERIFICATION_STATUS.UNCONFIRMED,
    ),
    ...overrides,
  });

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

export const createMedicationRequest = (
  medplum: MockClient,
  name: string,
  authoredOn: string | undefined,
  overrides: Partial<MedicationRequest> = {},
): Promise<MedicationRequest> =>
  medplum.createResource<MedicationRequest>({
    resourceType: RESOURCE_TYPE.MEDICATION_REQUEST,
    status: MEDICATION_REQUEST_STATUS.ACTIVE,
    intent: MEDICATION_REQUEST_INTENT.ORDER,
    subject: createReference(HomerSimpson),
    medicationCodeableConcept: { text: name },
    authoredOn,
    requester: doctor,
    ...overrides,
  });

export const interceptSearches = (
  medplum: MockClient,
  intercept: (
    search: () => Promise<Bundle>,
    resourceType: string,
    query: Parameters<MockClient["search"]>[1],
  ) => Promise<Bundle>,
) => {
  const search = medplum.search.bind(medplum);
  return vi
    .spyOn(medplum, "search")
    .mockImplementation(((resourceType, query, options) =>
      intercept(
        () => search(resourceType, query, options),
        resourceType,
        query,
      )) as typeof medplum.search);
};
