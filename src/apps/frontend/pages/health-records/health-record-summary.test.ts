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
import { codeFrom, oakDermatology, RECEIVED_AT } from "../../test-medplum";
import { showDatesInChicago } from "../../test-time-zone";
import { RecordSourceNames } from "../../types";
import {
  summarizeAllergyIntolerance,
  summarizeCondition,
  summarizeVitalSign,
} from "./health-record-summary";

const homer = createReference(HomerSimpson);

const noSourceNames = new RecordSourceNames();

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
  summarizeAllergyIntolerance(
    {
      resourceType: RESOURCE_TYPE.ALLERGY_INTOLERANCE,
      id: "amoxicillin",
      patient: homer,
      code: { text: "Amoxicillin" },
      clinicalStatus,
      verificationStatus,
    },
    noSourceNames,
  );

const summarizeConditionStatus = (
  clinicalStatus: CodeableConcept | undefined,
  verificationStatus: CodeableConcept | undefined,
) =>
  summarizeCondition(
    {
      resourceType: RESOURCE_TYPE.CONDITION,
      id: "asthma",
      subject: homer,
      code: { text: "Asthma" },
      clinicalStatus,
      verificationStatus,
    },
    noSourceNames,
  );

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
        summarizeCondition(
          {
            resourceType: RESOURCE_TYPE.CONDITION,
            id: "eczema",
            subject: homer,
            code,
          },
          noSourceNames,
        ),
      "Condition",
    ],
    [
      "an allergy",
      (code: CodeableConcept) =>
        summarizeAllergyIntolerance(
          {
            resourceType: RESOURCE_TYPE.ALLERGY_INTOLERANCE,
            id: "peanut",
            patient: homer,
            code,
          },
          noSourceNames,
        ),
      "Allergy",
    ],
    [
      "a measurement",
      (code: CodeableConcept) =>
        summarizeVitalSign(
          {
            resourceType: RESOURCE_TYPE.OBSERVATION,
            id: "weight",
            status: OBSERVATION_STATUS.FINAL,
            code,
          },
          noSourceNames,
        ),
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
      summarizeVitalSign(
        {
          resourceType: RESOURCE_TYPE.OBSERVATION,
          id: "blood-pressure",
          status,
          code: { text: "Blood pressure" },
        },
        noSourceNames,
      ).status,
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

  it("words an unconfirmed allergy as Unconfirmed, even when clinical status is active", () => {
    expect(
      summarizeAllergyStatus(
        allergyClinical(ALLERGY_INTOLERANCE_CLINICAL_STATUS.ACTIVE),
        allergyVerification(
          ALLERGY_INTOLERANCE_VERIFICATION_STATUS.UNCONFIRMED,
        ),
      ).status,
    ).toBe("Unconfirmed");
  });
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

  it("words an unconfirmed condition as Unconfirmed, even when clinical status is active", () => {
    expect(
      summarizeConditionStatus(
        conditionClinical(CONDITION_CLINICAL_STATUS.ACTIVE),
        conditionVerification(CONDITION_VERIFICATION_STATUS.UNCONFIRMED),
      ).status,
    ).toBe("Unconfirmed");
  });
});

describe("where a health record came from", () => {
  const meta = { source: oakDermatology.address, lastUpdated: RECEIVED_AT };
  const oakSourceNames = new RecordSourceNames([
    [oakDermatology.address, oakDermatology.name],
  ]);
  const summarizers = [
    [
      "a condition",
      (
        withMeta: typeof meta | undefined,
        recordSourceNames: RecordSourceNames,
      ) =>
        summarizeCondition(
          {
            resourceType: RESOURCE_TYPE.CONDITION,
            id: "eczema",
            subject: homer,
            meta: withMeta,
          },
          recordSourceNames,
        ),
    ],
    [
      "an allergy",
      (
        withMeta: typeof meta | undefined,
        recordSourceNames: RecordSourceNames,
      ) =>
        summarizeAllergyIntolerance(
          {
            resourceType: RESOURCE_TYPE.ALLERGY_INTOLERANCE,
            id: "penicillin",
            patient: homer,
            meta: withMeta,
          },
          recordSourceNames,
        ),
    ],
    [
      "a measurement",
      (
        withMeta: typeof meta | undefined,
        recordSourceNames: RecordSourceNames,
      ) =>
        summarizeVitalSign(
          {
            resourceType: RESOURCE_TYPE.OBSERVATION,
            id: "blood-pressure",
            status: OBSERVATION_STATUS.FINAL,
            code: { text: "Blood pressure" },
            meta: withMeta,
          },
          recordSourceNames,
        ),
    ],
  ] as const;

  it.each(summarizers)(
    "names the source of %s and words when the portal received it, in the patient's time zone",
    (_kind, summarize) => {
      showDatesInChicago();

      expect(summarize(meta, oakSourceNames)).toMatchObject({
        received: "October 28, 2026 · 4:10 PM Central Time",
        source: oakDermatology.name,
      });
    },
  );

  it.each(summarizers)(
    "names no source for %s whose source the patient's sources do not name",
    (_kind, summarize) => {
      expect(summarize(meta, noSourceNames)).toMatchObject({ source: "" });
    },
  );

  it.each(summarizers)(
    "names no source and no received date for %s that names neither",
    (_kind, summarize) => {
      expect(summarize(undefined, oakSourceNames)).toMatchObject({
        received: "",
        source: "",
      });
    },
  );

  it.each(summarizers)(
    "words no received time for %s whose last update is not a valid time",
    (_kind, summarize) => {
      expect(
        summarize(
          { ...meta, lastUpdated: "2026-10-28T99:00:00Z" },
          oakSourceNames,
        ),
      ).toMatchObject({ received: "" });
    },
  );
});
