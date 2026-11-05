import {
  AccessPolicyInteraction,
  createReference,
  getReferenceString,
  getSearchParameters,
  satisfiedAccessPolicy,
  type WithId,
} from "@medplum/core";
import type {
  AccessPolicy,
  Appointment,
  CarePlan,
  Patient,
  Reference,
  Resource,
} from "@medplum/fhirtypes";
import { describe, expect, it } from "vitest";

import patientAccessPolicy from "../../../../data/core/patient-access-policy.json";
import {
  APPOINTMENT_PARTICIPANT_STATUS,
  APPOINTMENT_STATUS,
  CARE_PLAN_INTENT,
  CARE_PLAN_STATUS,
  RESOURCE_TYPE,
  SEARCH_PARAMETER,
} from "./fhir";

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
