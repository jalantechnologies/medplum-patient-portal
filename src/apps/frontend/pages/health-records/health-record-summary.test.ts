import { createReference } from "@medplum/core";
import type { Annotation, CodeableConcept } from "@medplum/fhirtypes";
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

const summarizeAllergyNotes = (note: Annotation[] | undefined) =>
  summarizeAllergyIntolerance(
    {
      resourceType: RESOURCE_TYPE.ALLERGY_INTOLERANCE,
      id: "penicillin",
      patient: homer,
      code: { text: "Penicillin" },
      note,
    },
    noSourceNames,
  ).notes;

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
      "an active one",
      allergyClinical(ALLERGY_INTOLERANCE_CLINICAL_STATUS.ACTIVE),
      allergyVerification(ALLERGY_INTOLERANCE_VERIFICATION_STATUS.UNCONFIRMED),
    ],
    [
      "one with no clinical status",
      undefined,
      allergyVerification(ALLERGY_INTOLERANCE_VERIFICATION_STATUS.UNCONFIRMED),
    ],
    [
      "one whose verification is also coded in another system first",
      allergyClinical(ALLERGY_INTOLERANCE_CLINICAL_STATUS.ACTIVE),
      codedAlsoElsewhere(
        CODE_SYSTEM.ALLERGY_INTOLERANCE_VERIFICATION,
        ALLERGY_INTOLERANCE_VERIFICATION_STATUS.UNCONFIRMED,
      ),
    ],
  ])(
    "words an unconfirmed allergy as unconfirmed, %s",
    (_, clinicalStatus, verificationStatus) => {
      const summary = summarizeAllergyStatus(
        clinicalStatus,
        verificationStatus,
      );

      expect(summary.status).toBe("Unconfirmed");
      expect(summary.verification).toBe("Unconfirmed");
    },
  );

  it.each([
    [
      "inactive",
      allergyClinical(ALLERGY_INTOLERANCE_CLINICAL_STATUS.INACTIVE),
      "Inactive",
    ],
    [
      "resolved",
      allergyClinical(ALLERGY_INTOLERANCE_CLINICAL_STATUS.RESOLVED),
      "Resolved",
    ],
    [
      "resolved, also coded in another system first,",
      codedAlsoElsewhere(
        CODE_SYSTEM.ALLERGY_INTOLERANCE_CLINICAL,
        ALLERGY_INTOLERANCE_CLINICAL_STATUS.RESOLVED,
      ),
      "Resolved",
    ],
  ])(
    "words an unconfirmed allergy whose clinical status is %s by that status, with its verification unconfirmed",
    (_, clinicalStatus, status) => {
      const summary = summarizeAllergyStatus(
        clinicalStatus,
        allergyVerification(
          ALLERGY_INTOLERANCE_VERIFICATION_STATUS.UNCONFIRMED,
        ),
      );

      expect(summary.status).toBe(status);
      expect(summary.verification).toBe("Unconfirmed");
    },
  );

  it.each([
    [
      "confirmed",
      allergyVerification(ALLERGY_INTOLERANCE_VERIFICATION_STATUS.CONFIRMED),
    ],
    ["not given", undefined],
    [
      "unconfirmed, but coded only in the clinic's own system",
      {
        coding: [
          {
            system: clinicVerification.system,
            code: ALLERGY_INTOLERANCE_VERIFICATION_STATUS.UNCONFIRMED,
          },
        ],
      },
    ],
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

  it("keeps each note the clinic wrote on an allergy, in order, with its author and date where the note records them", () => {
    showDatesInChicago();

    expect(
      summarizeAllergyNotes([
        { text: "Rash recorded after penicillin." },
        {
          authorString: "Nurse Ana Synthetic",
          time: "2025-03-12T15:00:00Z",
          text: "Reaction and verification need clinical review.",
        },
      ]),
    ).toEqual([
      { author: "", date: "", text: "Rash recorded after penicillin." },
      {
        author: "Nurse Ana Synthetic",
        date: "March 12, 2025",
        text: "Reaction and verification need clinical review.",
      },
    ]);
  });

  it.each([
    [
      "only when it was written",
      { time: "2025-03-12T15:00:00Z", text: "Rash recorded." },
      { author: "", date: "March 12, 2025", text: "Rash recorded." },
    ],
    [
      "its author only as a reference with no name",
      {
        authorReference: { reference: "Practitioner/synthetic" },
        text: "Rash recorded.",
      },
      { author: "", date: "", text: "Rash recorded." },
    ],
  ])("keeps no author for a note that records %s", (_, note, summary) => {
    showDatesInChicago();

    expect(summarizeAllergyNotes([note])).toEqual([summary]);
  });

  it("names who wrote a note from its reference when the clinic recorded one", () => {
    expect(
      summarizeAllergyNotes([
        {
          authorReference: { display: "Dr. Mira Synthetic" },
          text: "Rash recorded after penicillin.",
        },
      ]),
    ).toEqual([
      {
        author: "Dr. Mira Synthetic",
        date: "",
        text: "Rash recorded after penicillin.",
      },
    ]);
  });

  it.each([
    ["no note at all", undefined],
    ["an empty list of notes", []],
  ])(
    "keeps no notes for an allergy the clinic wrote none on, given %s",
    (_, note) => {
      expect(summarizeAllergyNotes(note)).toEqual([]);
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
      "an active one",
      conditionClinical(CONDITION_CLINICAL_STATUS.ACTIVE),
      conditionVerification(CONDITION_VERIFICATION_STATUS.UNCONFIRMED),
      "Unconfirmed",
    ],
    [
      "a recurrence",
      conditionClinical(CONDITION_CLINICAL_STATUS.RECURRENCE),
      conditionVerification(CONDITION_VERIFICATION_STATUS.UNCONFIRMED),
      "Unconfirmed",
    ],
    [
      "a relapse",
      conditionClinical(CONDITION_CLINICAL_STATUS.RELAPSE),
      conditionVerification(CONDITION_VERIFICATION_STATUS.UNCONFIRMED),
      "Unconfirmed",
    ],
    [
      "one with no clinical status",
      undefined,
      conditionVerification(CONDITION_VERIFICATION_STATUS.UNCONFIRMED),
      "Unconfirmed",
    ],
    [
      "one whose verification is also coded in another system first",
      conditionClinical(CONDITION_CLINICAL_STATUS.ACTIVE),
      codedAlsoElsewhere(
        CODE_SYSTEM.CONDITION_VERIFICATION,
        CONDITION_VERIFICATION_STATUS.UNCONFIRMED,
      ),
      "Unconfirmed",
    ],
    [
      "a provisional one",
      conditionClinical(CONDITION_CLINICAL_STATUS.ACTIVE),
      conditionVerification(CONDITION_VERIFICATION_STATUS.PROVISIONAL),
      "Provisional",
    ],
    [
      "a differential one",
      conditionClinical(CONDITION_CLINICAL_STATUS.ACTIVE),
      conditionVerification(CONDITION_VERIFICATION_STATUS.DIFFERENTIAL),
      "Differential",
    ],
  ])(
    "words a condition that is unconfirmed, provisional or differential as unconfirmed, %s",
    (_, clinicalStatus, verificationStatus, verification) => {
      const summary = summarizeConditionStatus(
        clinicalStatus,
        verificationStatus,
      );

      expect(summary.status).toBe("Unconfirmed");
      expect(summary.verification).toBe(verification);
    },
  );

  it.each([
    [
      "inactive",
      CONDITION_VERIFICATION_STATUS.UNCONFIRMED,
      conditionClinical(CONDITION_CLINICAL_STATUS.INACTIVE),
      "Inactive",
      "Unconfirmed",
    ],
    [
      "resolved",
      CONDITION_VERIFICATION_STATUS.UNCONFIRMED,
      conditionClinical(CONDITION_CLINICAL_STATUS.RESOLVED),
      "Resolved",
      "Unconfirmed",
    ],
    [
      "remission",
      CONDITION_VERIFICATION_STATUS.UNCONFIRMED,
      conditionClinical(CONDITION_CLINICAL_STATUS.REMISSION),
      "Remission",
      "Unconfirmed",
    ],
    [
      "remission, also coded in another system first,",
      CONDITION_VERIFICATION_STATUS.UNCONFIRMED,
      codedAlsoElsewhere(
        CODE_SYSTEM.CONDITION_CLINICAL,
        CONDITION_CLINICAL_STATUS.REMISSION,
      ),
      "Remission",
      "Unconfirmed",
    ],
    [
      "resolved",
      CONDITION_VERIFICATION_STATUS.PROVISIONAL,
      conditionClinical(CONDITION_CLINICAL_STATUS.RESOLVED),
      "Resolved",
      "Provisional",
    ],
    [
      "remission",
      CONDITION_VERIFICATION_STATUS.DIFFERENTIAL,
      conditionClinical(CONDITION_CLINICAL_STATUS.REMISSION),
      "Remission",
      "Differential",
    ],
  ])(
    "words a condition whose clinical status is %s and whose verification is %s by that clinical status, with its verification kept",
    (_, verificationCode, clinicalStatus, status, verification) => {
      const summary = summarizeConditionStatus(
        clinicalStatus,
        conditionVerification(verificationCode),
      );

      expect(summary.status).toBe(status);
      expect(summary.verification).toBe(verification);
    },
  );

  it.each([
    [
      "confirmed",
      conditionVerification(CONDITION_VERIFICATION_STATUS.CONFIRMED),
    ],
    ["not given", undefined],
    [
      "unconfirmed, but coded only in the clinic's own system",
      {
        coding: [
          {
            system: clinicVerification.system,
            code: CONDITION_VERIFICATION_STATUS.UNCONFIRMED,
          },
        ],
      },
    ],
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
