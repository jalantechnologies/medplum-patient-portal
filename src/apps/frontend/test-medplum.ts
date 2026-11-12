import {
  createReference,
  parseSearchRequest,
  type QueryTypes,
  type SearchRequest,
  type WithId,
} from "@medplum/core";
import type {
  AllergyIntolerance,
  Appointment,
  Bundle,
  CarePlan,
  CodeableConcept,
  DiagnosticReport,
  MedicationRequest,
  Observation,
  ResourceType,
} from "@medplum/fhirtypes";
import { HomerSimpson, MockClient } from "@medplum/mock";
import { vi } from "vitest";

import {
  ALLERGY_INTOLERANCE_CLINICAL_STATUS,
  ALLERGY_INTOLERANCE_VERIFICATION_STATUS,
  APPOINTMENT_PARTICIPANT_STATUS,
  CARE_PLAN_INTENT,
  CODE_SYSTEM,
  DIAGNOSTIC_REPORT_STATUS,
  LABORATORY_SERVICE_SECTION,
  MEDICATION_REQUEST_INTENT,
  MEDICATION_REQUEST_STATUS,
  OBSERVATION_STATUS,
  RESOURCE_TYPE,
} from "./constants/fhir";

export const doctor = { display: "Dr. Mira Synthetic" };

export const laboratory = { display: "Harbor Synthetic Laboratory" };

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

export const createReportResult = (
  medplum: MockClient,
  name: string,
  overrides: Partial<Observation> = {},
): Promise<WithId<Observation>> =>
  medplum.createResource<Observation>({
    resourceType: RESOURCE_TYPE.OBSERVATION,
    status: OBSERVATION_STATUS.FINAL,
    code: { text: name },
    subject: createReference(HomerSimpson),
    ...overrides,
  });

export const createDiagnosticReport = (
  medplum: MockClient,
  name: string,
  effectiveDateTime: string | undefined,
  results: Observation[],
  overrides: Partial<DiagnosticReport> = {},
): Promise<DiagnosticReport> =>
  medplum.createResource<DiagnosticReport>({
    resourceType: RESOURCE_TYPE.DIAGNOSTIC_REPORT,
    status: DIAGNOSTIC_REPORT_STATUS.FINAL,
    category: [
      codeFrom(
        CODE_SYSTEM.DIAGNOSTIC_SERVICE_SECTION,
        LABORATORY_SERVICE_SECTION.LABORATORY,
      ),
    ],
    code: { text: name },
    subject: createReference(HomerSimpson),
    effectiveDateTime,
    performer: [laboratory],
    result: results.map((result) => createReference(result)),
    ...overrides,
  });

export const readSearchRequest = (
  medplum: MockClient,
  resourceType: ResourceType,
  query: QueryTypes,
): SearchRequest =>
  parseSearchRequest(medplum.fhirSearchUrl(resourceType, query));

export const failSearches = (
  medplum: MockClient,
  shouldFail: (searchRequest: SearchRequest) => boolean,
) =>
  vi
    .spyOn(medplum, "searchResources")
    .mockImplementation(((resourceType, query, options) =>
      shouldFail(readSearchRequest(medplum, resourceType, query))
        ? Promise.reject(networkFailure())
        : MockClient.prototype.searchResources.call(
            medplum,
            resourceType,
            query,
            options,
          )) as typeof medplum.searchResources);

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
