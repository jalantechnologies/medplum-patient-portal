import { createReference } from "@medplum/core";
import type { CodeableConcept } from "@medplum/fhirtypes";
import { HomerSimpson } from "@medplum/mock";
import { describe, expect, it } from "vitest";

import {
  ALLERGY_INTOLERANCE_CLINICAL_STATUS,
  ALLERGY_INTOLERANCE_VERIFICATION_STATUS,
  CODE_SYSTEM,
  CONDITION_CLINICAL_STATUS,
  CONDITION_VERIFICATION_STATUS,
  OBSERVATION_STATUS,
  RESOURCE_TYPE,
} from "../../constants/fhir";
import { codeFrom } from "../../test-medplum";
import {
  summarizeAllergyIntolerance,
  summarizeCondition,
  summarizeVitalSign,
} from "./health-record-summary";

const homer = createReference(HomerSimpson);

const clinicVerification = {
  system: "http://example.org/clinic-verification",
  code: "disproven-by-challenge",
};

const codedAlsoElsewhere = (system: string, code: string): CodeableConcept => ({
  coding: [clinicVerification, { system, code }],
});

const summarizeAllergyStatus = (
  clinicalStatus: CodeableConcept | undefined,
  verificationStatus: CodeableConcept | undefined,
) =>
  summarizeAllergyIntolerance({
    resourceType: RESOURCE_TYPE.ALLERGY_INTOLERANCE,
    id: "amoxicillin",
    patient: homer,
    code: { text: "Amoxicillin" },
    clinicalStatus,
    verificationStatus,
  });

const summarizeConditionStatus = (
  clinicalStatus: CodeableConcept | undefined,
  verificationStatus: CodeableConcept | undefined,
) =>
  summarizeCondition({
    resourceType: RESOURCE_TYPE.CONDITION,
    id: "asthma",
    subject: homer,
    code: { text: "Asthma" },
    clinicalStatus,
    verificationStatus,
  });

const allergyClinical = (code: string) =>
  codeFrom(CODE_SYSTEM.ALLERGY_INTOLERANCE_CLINICAL, code);

const allergyVerification = (code: string) =>
  codeFrom(CODE_SYSTEM.ALLERGY_INTOLERANCE_VERIFICATION, code);

const conditionClinical = (code: string) =>
  codeFrom(CODE_SYSTEM.CONDITION_CLINICAL, code);

const conditionVerification = (code: string) =>
  codeFrom(CODE_SYSTEM.CONDITION_VERIFICATION, code);

describe("naming a health record", () => {
  const multiplyCoded: CodeableConcept = {
    coding: [
      { code: "L20.9" },
      { code: "24079001", display: "Atopic dermatitis" },
      { code: "L20.89", display: "Other atopic dermatitis" },
    ],
  };

  it.each([
    [
      "a condition",
      (code: CodeableConcept) =>
        summarizeCondition({
          resourceType: RESOURCE_TYPE.CONDITION,
          id: "eczema",
          subject: homer,
          code,
        }),
      "Condition",
    ],
    [
      "an allergy",
      (code: CodeableConcept) =>
        summarizeAllergyIntolerance({
          resourceType: RESOURCE_TYPE.ALLERGY_INTOLERANCE,
          id: "peanut",
          patient: homer,
          code,
        }),
      "Allergy",
    ],
    [
      "a measurement",
      (code: CodeableConcept) =>
        summarizeVitalSign({
          resourceType: RESOURCE_TYPE.OBSERVATION,
          id: "weight",
          status: OBSERVATION_STATUS.FINAL,
          code,
        }),
      "Measurement",
    ],
  ])(
    "names %s by its text, else its first coding that has a name, else a plain word",
    (_, summarize, plainWord) => {
      expect(summarize({ ...multiplyCoded, text: "Eczema" }).title).toBe(
        "Eczema",
      );
      expect(summarize(multiplyCoded).title).toBe("Atopic dermatitis");
      expect(summarize({ coding: [{ code: "L20.9" }] }).title).toBe(plainWord);
    },
  );
});

describe("summarizeVitalSign", () => {
  it.each([
    [OBSERVATION_STATUS.FINAL, "Final"],
    [OBSERVATION_STATUS.ENTERED_IN_ERROR, "Entered in error"],
  ])("words the status %s as %s", (status, words) => {
    expect(
      summarizeVitalSign({
        resourceType: RESOURCE_TYPE.OBSERVATION,
        id: "blood-pressure",
        status,
        code: { text: "Blood pressure" },
      }).status,
    ).toBe(words);
  });
});

describe("summarizeAllergyIntolerance", () => {
  it.each([
    [
      "an active one",
      allergyClinical(ALLERGY_INTOLERANCE_CLINICAL_STATUS.ACTIVE),
      allergyVerification(ALLERGY_INTOLERANCE_VERIFICATION_STATUS.REFUTED),
    ],
    [
      "a resolved one",
      allergyClinical(ALLERGY_INTOLERANCE_CLINICAL_STATUS.RESOLVED),
      allergyVerification(ALLERGY_INTOLERANCE_VERIFICATION_STATUS.REFUTED),
    ],
    [
      "one with no clinical status",
      undefined,
      allergyVerification(ALLERGY_INTOLERANCE_VERIFICATION_STATUS.REFUTED),
    ],
    [
      "one whose verification is also coded in another system first",
      allergyClinical(ALLERGY_INTOLERANCE_CLINICAL_STATUS.ACTIVE),
      codedAlsoElsewhere(
        CODE_SYSTEM.ALLERGY_INTOLERANCE_VERIFICATION,
        ALLERGY_INTOLERANCE_VERIFICATION_STATUS.REFUTED,
      ),
    ],
  ])(
    "words an allergy the clinician ruled out as ruled out, even %s",
    (_, clinicalStatus, verificationStatus) => {
      const summary = summarizeAllergyStatus(
        clinicalStatus,
        verificationStatus,
      );

      expect(summary.status).toBe("Ruled out");
      expect(summary.verification).toBe("Refuted");
    },
  );

  it.each([
    [
      "unconfirmed",
      allergyVerification(ALLERGY_INTOLERANCE_VERIFICATION_STATUS.UNCONFIRMED),
    ],
    [
      "confirmed",
      allergyVerification(ALLERGY_INTOLERANCE_VERIFICATION_STATUS.CONFIRMED),
    ],
    ["not given", undefined],
  ])(
    "words an allergy by its clinical status when its verification is %s",
    (_, verificationStatus) => {
      expect(
        summarizeAllergyStatus(
          allergyClinical(ALLERGY_INTOLERANCE_CLINICAL_STATUS.ACTIVE),
          verificationStatus,
        ).status,
      ).toBe("Active");
    },
  );
});

describe("summarizeCondition", () => {
  it.each([
    [
      "an active one",
      conditionClinical(CONDITION_CLINICAL_STATUS.ACTIVE),
      conditionVerification(CONDITION_VERIFICATION_STATUS.REFUTED),
    ],
    [
      "an inactive one",
      conditionClinical(CONDITION_CLINICAL_STATUS.INACTIVE),
      conditionVerification(CONDITION_VERIFICATION_STATUS.REFUTED),
    ],
    [
      "one with no clinical status",
      undefined,
      conditionVerification(CONDITION_VERIFICATION_STATUS.REFUTED),
    ],
    [
      "one whose verification is also coded in another system first",
      conditionClinical(CONDITION_CLINICAL_STATUS.ACTIVE),
      codedAlsoElsewhere(
        CODE_SYSTEM.CONDITION_VERIFICATION,
        CONDITION_VERIFICATION_STATUS.REFUTED,
      ),
    ],
  ])(
    "words a condition the clinician ruled out as ruled out, even %s",
    (_, clinicalStatus, verificationStatus) => {
      const summary = summarizeConditionStatus(
        clinicalStatus,
        verificationStatus,
      );

      expect(summary.status).toBe("Ruled out");
      expect(summary.verification).toBe("Refuted");
    },
  );

  it.each([
    [
      "provisional",
      conditionVerification(CONDITION_VERIFICATION_STATUS.PROVISIONAL),
    ],
    [
      "confirmed",
      conditionVerification(CONDITION_VERIFICATION_STATUS.CONFIRMED),
    ],
    ["not given", undefined],
  ])(
    "words a condition by its clinical status when its verification is %s",
    (_, verificationStatus) => {
      expect(
        summarizeConditionStatus(
          conditionClinical(CONDITION_CLINICAL_STATUS.ACTIVE),
          verificationStatus,
        ).status,
      ).toBe("Active");
    },
  );
});
