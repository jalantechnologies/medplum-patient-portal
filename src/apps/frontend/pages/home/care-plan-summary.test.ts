import { createReference, type WithId } from "@medplum/core";
import type { CarePlan } from "@medplum/fhirtypes";
import { HomerSimpson } from "@medplum/mock";
import { describe, expect, it } from "vitest";

import {
  CARE_PLAN_INTENT,
  CARE_PLAN_STATUS,
  RESOURCE_TYPE,
} from "../../constants/fhir";
import { doctor, mapleDental, oakDermatology } from "../../test-medplum";
import { RecordSourceNames } from "../../types";
import { summarizeCarePlan } from "./care-plan-summary";

const oakSourceNames = new RecordSourceNames([
  [oakDermatology.address, oakDermatology.name],
]);

const summarize = (overrides: Partial<CarePlan>) =>
  summarizeCarePlan(
    {
      resourceType: RESOURCE_TYPE.CARE_PLAN,
      id: "eczema-care",
      status: CARE_PLAN_STATUS.ACTIVE,
      intent: CARE_PLAN_INTENT.PLAN,
      subject: createReference(HomerSimpson),
      ...overrides,
    } satisfies WithId<CarePlan>,
    oakSourceNames,
  );

describe("summarizeCarePlan", () => {
  it("names the plan, its clinic, its start, its author and its status", () => {
    expect(
      summarize({
        title: "Eczema care",
        period: { start: "2026-10-20" },
        author: doctor,
        meta: { source: oakDermatology.address },
      }),
    ).toEqual({
      author: "Dr. Mira Synthetic",
      date: "October 20, 2026",
      identifier: "eczema-care",
      source: oakDermatology.name,
      status: "Active",
      title: "Eczema care",
    });
  });

  it("names a plan with no title by its first category that has a name, else as a care plan", () => {
    expect(
      summarize({
        category: [
          { coding: [{ code: "736285004" }] },
          { text: "Weight management" },
        ],
      }).title,
    ).toBe("Weight management");
    expect(summarize({}).title).toBe("Care plan");
  });

  it("dates a plan by its start, else its end, as Medplum sorts plans, and not by when it was created", () => {
    expect(summarize({ period: { end: "2025-04-08" } }).date).toBe(
      "April 8, 2025",
    );
    expect(summarize({ created: "2024-03" }).date).toBe("");
    expect(summarize({}).date).toBe("");
  });

  it("names no clinic for a plan from a source the patient's list does not name, or with no source", () => {
    expect(summarize({ meta: { source: mapleDental.address } }).source).toBe(
      "",
    );
    expect(summarize({}).source).toBe("");
  });

  it.each([
    [CARE_PLAN_STATUS.ACTIVE, "Active"],
    [CARE_PLAN_STATUS.COMPLETED, "Completed"],
    [CARE_PLAN_STATUS.ON_HOLD, "On hold"],
    [CARE_PLAN_STATUS.REVOKED, "Revoked"],
    [CARE_PLAN_STATUS.DRAFT, "Draft"],
    [CARE_PLAN_STATUS.UNKNOWN, "Unknown"],
  ])("words the status %s as %s", (status, words) => {
    expect(summarize({ status }).status).toBe(words);
  });
});
