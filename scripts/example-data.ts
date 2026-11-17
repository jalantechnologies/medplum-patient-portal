import {
  crawlTypedValue,
  formatFamilyName,
  formatGivenName,
  indexStructureDefinitionBundle,
  type InviteRequest,
  isOk,
  isResource,
  isResourceWithId,
  normalizeErrorString,
  PropertyType,
  toTypedValue,
  type TypedValue,
  type TypedValueWithPath,
  type WithId,
} from "@medplum/core";
import { readJson } from "@medplum/definitions";
import type { Bundle, Patient } from "@medplum/fhirtypes";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { RESOURCE_TYPE } from "../src/apps/frontend/constants/fhir.ts";

export type PatientName = Pick<InviteRequest, "firstName" | "lastName">;

const EXAMPLE_BUNDLE_PATH = join(
  import.meta.dirname,
  "../data/example/eleanor-walsh.json",
);
const STRUCTURE_DEFINITION_FILES = [
  "fhir/r4/profiles-types.json",
  "fhir/r4/profiles-resources.json",
];
const DATE_TYPES = new Set<string>([
  PropertyType.date,
  PropertyType.dateTime,
  PropertyType.instant,
]);
const SOURCES_TIME_ZONE = "America/Chicago";
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CLOCK_TIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

export const indexFhirDefinitions = (): void => {
  for (const fileName of STRUCTURE_DEFINITION_FILES) {
    indexStructureDefinitionBundle(readJson(fileName) as Bundle);
  }
};

export const readExampleBundle = async (): Promise<Bundle> =>
  JSON.parse(await readFile(EXAMPLE_BUNDLE_PATH, "utf8")) as Bundle;

const moveDate = (value: string, days: number): string => {
  if (DAY_PATTERN.test(value)) {
    return Temporal.PlainDate.from(value).add({ days }).toString();
  }
  if (CLOCK_TIME_PATTERN.test(value)) {
    return Temporal.Instant.from(value)
      .toZonedDateTimeISO(SOURCES_TIME_ZONE)
      .add({ days })
      .toString({ timeZoneName: "never" });
  }
  throw new Error(
    `${value} cannot move by days: it needs a year, a month and a day, and a time needs its seconds and its offset from UTC.`,
  );
};

const countDaysTo = (timestamp: string, day: Temporal.PlainDate): number =>
  Temporal.Instant.from(timestamp)
    .toZonedDateTimeISO(SOURCES_TIME_ZONE)
    .toPlainDate()
    .until(day).days;

export const isDate = ({ type, value }: TypedValue): boolean =>
  DATE_TYPES.has(type) &&
  (typeof value === "string" || value instanceof String);

const moveDatesOfProperty = (
  parent: TypedValueWithPath,
  key: string,
  propertyValues: (TypedValueWithPath | TypedValueWithPath[])[],
  days: number,
): void => {
  for (const propertyValue of propertyValues) {
    if (Array.isArray(propertyValue)) {
      propertyValue.forEach((element, index) => {
        if (isDate(element)) {
          parent.value[key][index] = moveDate(String(element.value), days);
        }
      });
    } else if (isDate(propertyValue)) {
      parent.value[key] = moveDate(String(propertyValue.value), days);
    }
  }
};

export const moveDatesToDay = (
  bundle: Bundle,
  day: Temporal.PlainDate,
): Bundle => {
  if (!bundle.timestamp) {
    throw new Error("The example bundle needs a timestamp to move dates from.");
  }
  const days = countDaysTo(bundle.timestamp, day);
  const movedBundle = structuredClone(bundle);
  crawlTypedValue(
    toTypedValue(movedBundle),
    {
      visitProperty: (parent, key, _path, propertyValues) =>
        moveDatesOfProperty(parent, key, propertyValues, days),
    },
    { skipMissingProperties: true },
  );
  return movedBundle;
};

export const readPatientName = (bundle: Bundle): PatientName => {
  const patient = bundle.entry
    ?.map(({ resource }) => resource)
    .find((resource) => isResource<Patient>(resource, RESOURCE_TYPE.PATIENT));
  const [name] = patient?.name ?? [];
  if (!name?.given?.length || !name.family) {
    throw new Error(
      "The example patient needs a given and a family name: Medplum's invite asks for both.",
    );
  }
  return { firstName: formatGivenName(name), lastName: formatFamilyName(name) };
};

export const assertEveryEntrySucceeded = (response: Bundle): void => {
  const failures = (response.entry ?? [])
    .map(({ response: entryResponse }) => entryResponse?.outcome)
    .filter((outcome) => outcome !== undefined && !isOk(outcome))
    .map((outcome) => normalizeErrorString(outcome));
  if (failures.length > 0) {
    throw new Error(
      `Medplum refused part of the example data: ${failures.join("; ")}`,
    );
  }
};

export const findPatient = (response: Bundle): WithId<Patient> => {
  const patient = response.entry
    ?.map(({ resource }) => resource)
    .find((resource) =>
      isResourceWithId<Patient>(resource, RESOURCE_TYPE.PATIENT),
    );
  if (!patient) {
    throw new Error("Medplum's response holds no patient.");
  }
  return patient;
};
