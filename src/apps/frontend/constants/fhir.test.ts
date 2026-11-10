import {
  AccessPolicyInteraction,
  createReference,
  getReferenceString,
  getSearchParameters,
  satisfiedAccessPolicy,
  type WithId,
} from "@medplum/core";
import { readJson } from "@medplum/definitions";
import type {
  AccessPolicy,
  AllergyIntolerance,
  Appointment,
  Bundle,
  CarePlan,
  CodeSystem,
  CodeSystemConcept,
  Condition,
  MedicationRequest,
  Observation,
  Patient,
  Reference,
  Resource,
} from "@medplum/fhirtypes";
import { describe, expect, it } from "vitest";

import patientAccessPolicy from "../../../../data/core/patient-access-policy.json";
import {
  ALLERGY_INTOLERANCE_CLINICAL_STATUS,
  ALLERGY_INTOLERANCE_VERIFICATION_STATUS,
  APPOINTMENT_PARTICIPANT_STATUS,
  APPOINTMENT_STATUS,
  CARE_PLAN_INTENT,
  CARE_PLAN_STATUS,
  CODE_SYSTEM,
  CONDITION_CLINICAL_STATUS,
  CONDITION_VERIFICATION_STATUS,
  MEDICATION_REQUEST_INTENT,
  MEDICATION_REQUEST_STATUS,
  OBSERVATION_CATEGORY,
  OBSERVATION_STATUS,
  RESOURCE_TYPE,
  SEARCH_PARAMETER,
} from "./fhir";

describe("CODE_SYSTEM", () => {
  const terminologyBundle = readJson(
    "fhir/r4/valuesets.json",
  ) as Bundle<CodeSystem>;

  const listConceptCodes = (concepts: CodeSystemConcept[] = []): string[] =>
    concepts.flatMap((concept) => [
      concept.code,
      ...listConceptCodes(concept.concept),
    ]);

  const listCodeSystemCodes = (system: string) =>
    listConceptCodes(
      terminologyBundle.entry?.find((entry) => entry.resource?.url === system)
        ?.resource?.concept,
    );

  it.each([
    [
      CODE_SYSTEM.ALLERGY_INTOLERANCE_CLINICAL,
      ALLERGY_INTOLERANCE_CLINICAL_STATUS,
    ],
    [
      CODE_SYSTEM.ALLERGY_INTOLERANCE_VERIFICATION,
      ALLERGY_INTOLERANCE_VERIFICATION_STATUS,
    ],
    [CODE_SYSTEM.CONDITION_CLINICAL, CONDITION_CLINICAL_STATUS],
    [CODE_SYSTEM.CONDITION_VERIFICATION, CONDITION_VERIFICATION_STATUS],
  ])("names every code of %s, and only those", (system, codes) => {
    expect(Object.values(codes).toSorted()).toEqual(
      listCodeSystemCodes(system).toSorted(),
    );
  });

  it("names only observation categories that FHIR defines", () => {
    expect(listCodeSystemCodes(CODE_SYSTEM.OBSERVATION_CATEGORY)).toEqual(
      expect.arrayContaining(Object.values(OBSERVATION_CATEGORY)),
    );
  });
});

describe("SEARCH_PARAMETER", () => {
  it("names only search parameters that FHIR defines for the portal's resource types", () => {
    const definedSearchParameterNames = new Set(
      Object.values(RESOURCE_TYPE).flatMap((resourceType) =>
        Object.keys(getSearchParameters(resourceType) ?? {}),
      ),
    );

    for (const searchParameterName of Object.values(SEARCH_PARAMETER)) {
      expect(definedSearchParameterNames).toContain(searchParameterName);
    }
  });
});

describe("patient access policy", () => {
  const PATIENT_VARIABLE = "%patient";
  const quinn: WithId<Patient> = {
    resourceType: RESOURCE_TYPE.PATIENT,
    id: "quinn",
  };
  const harper: WithId<Patient> = {
    resourceType: RESOURCE_TYPE.PATIENT,
    id: "harper",
  };

  const buildRecordAbout: Record<
    string,
    (patient: Reference<Patient>) => Resource
  > = {
    [RESOURCE_TYPE.APPOINTMENT]: (patient): Appointment => ({
      resourceType: RESOURCE_TYPE.APPOINTMENT,
      status: APPOINTMENT_STATUS.BOOKED,
      participant: [
        { actor: patient, status: APPOINTMENT_PARTICIPANT_STATUS.ACCEPTED },
      ],
    }),
    [RESOURCE_TYPE.CARE_PLAN]: (patient): CarePlan => ({
      resourceType: RESOURCE_TYPE.CARE_PLAN,
      status: CARE_PLAN_STATUS.ACTIVE,
      intent: CARE_PLAN_INTENT.PLAN,
      subject: patient,
    }),
    [RESOURCE_TYPE.ALLERGY_INTOLERANCE]: (patient): AllergyIntolerance => ({
      resourceType: RESOURCE_TYPE.ALLERGY_INTOLERANCE,
      patient,
    }),
    [RESOURCE_TYPE.CONDITION]: (patient): Condition => ({
      resourceType: RESOURCE_TYPE.CONDITION,
      subject: patient,
    }),
    [RESOURCE_TYPE.MEDICATION_REQUEST]: (patient): MedicationRequest => ({
      resourceType: RESOURCE_TYPE.MEDICATION_REQUEST,
      status: MEDICATION_REQUEST_STATUS.ACTIVE,
      intent: MEDICATION_REQUEST_INTENT.ORDER,
      medicationCodeableConcept: { text: "Triamcinolone 0.1% cream" },
      subject: patient,
    }),
    [RESOURCE_TYPE.OBSERVATION]: (patient): Observation => ({
      resourceType: RESOURCE_TYPE.OBSERVATION,
      status: OBSERVATION_STATUS.FINAL,
      code: { text: "Blood pressure" },
      subject: patient,
    }),
  };

  const fillPolicyFor = (patient: WithId<Patient>): AccessPolicy => {
    // Medplum's server fills in `%patient.id` before `%patient` (buildAccessPolicyResources), and the test must see the policy as the server does.
    const filledPolicy: AccessPolicy = JSON.parse(
      JSON.stringify(patientAccessPolicy)
        .replaceAll(`${PATIENT_VARIABLE}.id`, patient.id)
        .replaceAll(PATIENT_VARIABLE, getReferenceString(patient)),
    );
    return filledPolicy;
  };

  const listAllowedInteractions = (
    record: Resource,
    accessPolicy: AccessPolicy,
  ): AccessPolicyInteraction[] =>
    Object.values(AccessPolicyInteraction).filter((interaction) =>
      satisfiedAccessPolicy(record, interaction, accessPolicy),
    );

  const policyResourceTypes = patientAccessPolicy.resource.map(
    (policyResource) => policyResource.resourceType,
  );

  it("has a record to check for each resource type it grants", () => {
    expect(Object.keys(buildRecordAbout).toSorted()).toEqual(
      policyResourceTypes.toSorted(),
    );
  });

  it.each(policyResourceTypes)(
    "lets a patient only search their own %s records",
    (resourceType) => {
      const quinnPolicy = fillPolicyFor(quinn);
      const quinnRecord = buildRecordAbout[resourceType](
        createReference(quinn),
      );
      const harperRecord = buildRecordAbout[resourceType](
        createReference(harper),
      );

      expect(listAllowedInteractions(quinnRecord, quinnPolicy)).toEqual([
        AccessPolicyInteraction.SEARCH,
      ]);
      expect(listAllowedInteractions(harperRecord, quinnPolicy)).toEqual([]);
    },
  );
});
