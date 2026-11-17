import {
  allOk,
  badRequest,
  crawlTypedValue,
  created,
  getIdentifier,
  getStatus,
  indexSearchParameterBundle,
  isResource,
  matchesSearchRequest,
  parseSearchRequest,
  toTypedValue,
  validateResource,
} from "@medplum/core";
import { readJson } from "@medplum/definitions";
import type {
  Bundle,
  BundleEntry,
  OperationOutcome,
  Organization,
  Patient,
  Resource,
  SearchParameter,
} from "@medplum/fhirtypes";
import { beforeAll, describe, expect, it } from "vitest";

import {
  BUNDLE_REQUEST_METHOD,
  BUNDLE_TYPE,
  IDENTIFIER_SYSTEM,
  MEDICATION_REQUEST_INTENT,
  MEDICATION_REQUEST_STATUS,
  OBSERVATION_STATUS,
  RESOURCE_TYPE,
  SEARCH_PARAMETER,
} from "../src/apps/frontend/constants/fhir.ts";
import {
  assertEveryEntrySucceeded,
  findPatient,
  indexFhirDefinitions,
  isDate,
  moveDatesToDay,
  readExampleBundle,
  readPatientName,
} from "./example-data.ts";

const LOAD_DAY = Temporal.PlainDate.from("2026-11-17");
const SUMMER_LOAD_DAY = Temporal.PlainDate.from("2027-07-01");
const DAYS_TO_LOAD_DAY = 19;
const DATES_IN_EXAMPLE = 16;
const DAY_LENGTH = "YYYY-MM-DD".length;
const CLOCK_TIME_LENGTH = "YYYY-MM-DDThh:mm:ss".length;
const NOT_RECORDED_EXTENSION = {
  extension: [
    {
      url: "http://example.org/not-recorded",
      valueString: "Not recorded",
    },
  ],
};

let exampleBundle: Bundle;
let resources: Resource[];

const isSource = (resource: Resource): resource is Organization =>
  isResource<Organization>(resource, RESOURCE_TYPE.ORGANIZATION);

const sourceAddresses = (): string[] =>
  resources
    .filter(isSource)
    .flatMap(({ identifier = [] }) =>
      identifier
        .filter(({ system }) => system === IDENTIFIER_SYSTEM.URI)
        .map(({ value }) => value ?? ""),
    );

const collectDates = (bundle: Bundle): string[] => {
  const dates: string[] = [];
  crawlTypedValue(
    toTypedValue(bundle),
    {
      visitProperty: (_parent, _key, _path, propertyValues) => {
        for (const propertyValue of propertyValues.flat()) {
          if (isDate(propertyValue)) {
            dates.push(String(propertyValue.value));
          }
        }
      },
    },
    { skipMissingProperties: true },
  );
  return dates;
};

const countDaysBetween = (earlier: string, later: string): number =>
  Temporal.PlainDate.from(earlier.slice(0, DAY_LENGTH)).until(
    Temporal.PlainDate.from(later.slice(0, DAY_LENGTH)),
  ).days;

const collectReferences = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.flatMap(collectReferences);
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) =>
      key === "reference" && typeof child === "string"
        ? [child]
        : collectReferences(child),
    );
  }
  return [];
};

const bundleOf = (timestamp: string, resource: Resource): Bundle => ({
  resourceType: RESOURCE_TYPE.BUNDLE,
  type: BUNDLE_TYPE.TRANSACTION,
  timestamp,
  entry: [{ resource }],
});

const responseEntry = (
  outcome: OperationOutcome,
  resource?: Resource,
): BundleEntry => ({
  resource,
  response: { status: String(getStatus(outcome)), outcome },
});

const transactionResponse = (entries: BundleEntry[]): Bundle => ({
  resourceType: RESOURCE_TYPE.BUNDLE,
  type: BUNDLE_TYPE.TRANSACTION_RESPONSE,
  entry: entries,
});

const withPatientName = (name: Patient["name"]): Bundle => ({
  ...exampleBundle,
  entry: exampleBundle.entry?.map((entry) =>
    isResource<Patient>(entry.resource, RESOURCE_TYPE.PATIENT)
      ? { ...entry, resource: { ...entry.resource, name } }
      : entry,
  ),
});

beforeAll(async () => {
  indexFhirDefinitions();
  indexSearchParameterBundle(
    readJson("fhir/r4/search-parameters.json") as Bundle<SearchParameter>,
  );
  exampleBundle = await readExampleBundle();
  resources = (exampleBundle.entry ?? []).flatMap(
    ({ resource }) => resource ?? [],
  );
});

describe("example data", () => {
  it("is a transaction, the bundle type whose entries FHIR lets refer to each other", () => {
    expect(exampleBundle.type).toBe(BUNDLE_TYPE.TRANSACTION);
  });

  it("names the prototype's four sources, each by its address", () => {
    expect(sourceAddresses()).toEqual([
      "https://fhir.oak-dermatology.example",
      "https://fhir.harbor-laboratory.example",
      "https://fhir.maple-dental.example",
      "https://fhir.pine-family-clinic.example",
    ]);
  });

  it("gives every record the address of the source it came from and its identifier there", () => {
    const addresses = sourceAddresses();
    const records = resources.filter(
      (resource) =>
        !isSource(resource) &&
        !isResource<Patient>(resource, RESOURCE_TYPE.PATIENT),
    );

    for (const record of records) {
      const source = record.meta?.source ?? "";
      expect(addresses).toContain(source);
      expect(
        getIdentifier(record, `${source}/${record.resourceType}`),
      ).toBeDefined();
    }
  });

  it("keeps each source's own number for the patient on her one patient record", () => {
    const patients = resources.filter((resource) =>
      isResource<Patient>(resource, RESOURCE_TYPE.PATIENT),
    );

    expect(patients).toHaveLength(1);
    expect((patients[0].identifier ?? []).map(({ system }) => system)).toEqual(
      sourceAddresses().map((address) => `${address}/${RESOURCE_TYPE.PATIENT}`),
    );
  });

  it("loads every resource by an identifier that matches it alone, so loading again updates it in place", () => {
    for (const { request, resource } of exampleBundle.entry ?? []) {
      const searchRequest = parseSearchRequest(request?.url ?? "");

      expect(request?.method).toBe(BUNDLE_REQUEST_METHOD.PUT);
      expect(searchRequest.filters?.map(({ code }) => code)).toEqual([
        SEARCH_PARAMETER.IDENTIFIER,
      ]);
      expect(
        resources.filter((candidate) =>
          matchesSearchRequest(candidate, searchRequest),
        ),
      ).toEqual([resource]);
    }
  });

  it("refers only to resources in the same bundle", () => {
    const fullUrls = (exampleBundle.entry ?? []).map(({ fullUrl }) => fullUrl);

    for (const reference of collectReferences(exampleBundle.entry)) {
      expect(fullUrls).toContain(reference);
    }
  });

  it("holds only valid FHIR resources", () => {
    for (const resource of resources) {
      expect(() => validateResource(resource)).not.toThrow();
    }
  });
});

describe("moveDatesToDay", () => {
  it("moves the prototype's demo day to the load day", () => {
    expect(moveDatesToDay(exampleBundle, LOAD_DAY).timestamp).toBe(
      "2026-11-17T00:00:00-06:00",
    );
  });

  it("moves every date by the same number of days, keeping its Central clock time", () => {
    const originalDates = collectDates(exampleBundle);
    const movedDates = collectDates(moveDatesToDay(exampleBundle, LOAD_DAY));

    expect(originalDates).toHaveLength(DATES_IN_EXAMPLE);
    expect(movedDates).toHaveLength(DATES_IN_EXAMPLE);
    movedDates.forEach((movedDate, index) => {
      const originalDate = originalDates[index];
      expect(countDaysBetween(originalDate, movedDate)).toBe(DAYS_TO_LOAD_DAY);
      expect(movedDate.slice(DAY_LENGTH, CLOCK_TIME_LENGTH)).toBe(
        originalDate.slice(DAY_LENGTH, CLOCK_TIME_LENGTH),
      );
    });
    expect(movedDates).toContain("2026-11-22T10:30:00-06:00");
  });

  it("gives a moved time the Central offset of its new day, across daylight saving time", () => {
    const fallDates = collectDates(moveDatesToDay(exampleBundle, LOAD_DAY));
    const summerDates = collectDates(
      moveDatesToDay(exampleBundle, SUMMER_LOAD_DAY),
    );

    expect(fallDates).toContain("2026-11-07T09:00:00-06:00");
    expect(summerDates).toContain("2027-07-06T10:30:00-05:00");
    expect(summerDates).toContain("2027-06-21T09:00:00-05:00");
  });

  it("writes a time recorded in another offset as the Central clock time it stands for", () => {
    const bundle = bundleOf("2026-10-29T00:00:00-05:00", {
      resourceType: RESOURCE_TYPE.OBSERVATION,
      status: OBSERVATION_STATUS.FINAL,
      code: { text: "Example measurement" },
      issued: "2026-10-20T14:00:00.250Z",
    });

    const [{ resource }] = moveDatesToDay(bundle, LOAD_DAY).entry ?? [];

    expect(resource).toMatchObject({ issued: "2026-11-08T09:00:00.25-06:00" });
  });

  it("moves dates across a month and a year", () => {
    const bundle = bundleOf("2026-12-30T00:00:00-06:00", {
      resourceType: RESOURCE_TYPE.CONDITION,
      subject: { display: "Example patient" },
      recordedDate: "2026-12-30",
      onsetDateTime: "2026-02-28T08:00:00-06:00",
    });

    const [{ resource }] =
      moveDatesToDay(bundle, Temporal.PlainDate.from("2027-01-02")).entry ?? [];

    expect(resource).toMatchObject({
      recordedDate: "2027-01-02",
      onsetDateTime: "2026-03-03T08:00:00-06:00",
    });
  });

  it("moves a date in the first century as written", () => {
    const bundle = bundleOf("2026-10-29T00:00:00-05:00", {
      resourceType: RESOURCE_TYPE.CONDITION,
      subject: { display: "Example patient" },
      recordedDate: "0050-01-01",
    });

    const [{ resource }] = moveDatesToDay(bundle, LOAD_DAY).entry ?? [];

    expect(resource).toMatchObject({ recordedDate: "0050-01-20" });
  });

  it("moves a date that also has an extension", () => {
    const bundle = bundleOf("2026-10-29T00:00:00-05:00", {
      resourceType: RESOURCE_TYPE.CONDITION,
      subject: { display: "Example patient" },
      recordedDate: "2026-10-20",
      _recordedDate: NOT_RECORDED_EXTENSION,
    } as Resource);

    const [{ resource }] = moveDatesToDay(bundle, LOAD_DAY).entry ?? [];

    expect(resource).toMatchObject({
      recordedDate: "2026-11-08",
      _recordedDate: NOT_RECORDED_EXTENSION,
    });
  });

  it("moves each date in a list, with or without an extension, skipping a place that holds only an extension", () => {
    const bundle = bundleOf("2026-10-29T00:00:00-05:00", {
      resourceType: RESOURCE_TYPE.MEDICATION_REQUEST,
      status: MEDICATION_REQUEST_STATUS.ACTIVE,
      intent: MEDICATION_REQUEST_INTENT.ORDER,
      subject: { display: "Example patient" },
      medicationCodeableConcept: { text: "Example medicine" },
      dosageInstruction: [
        {
          timing: {
            event: [null, "2026-10-20T08:00:00-05:00", "2026-10-21"],
            _event: [NOT_RECORDED_EXTENSION, NOT_RECORDED_EXTENSION, null],
          },
        },
      ],
    } as unknown as Resource);

    const [{ resource }] = moveDatesToDay(bundle, LOAD_DAY).entry ?? [];

    expect(resource).toMatchObject({
      dosageInstruction: [
        {
          timing: {
            event: [null, "2026-11-08T08:00:00-06:00", "2026-11-09"],
          },
        },
      ],
    });
  });

  it("leaves the bundle it is given as it is", () => {
    const original = structuredClone(exampleBundle);

    moveDatesToDay(exampleBundle, LOAD_DAY);

    expect(exampleBundle).toEqual(original);
  });

  it.each(["2024-03", "2026-10-20T08:00"])(
    "refuses %s, which cannot move by whole days",
    (date) => {
      const bundle = bundleOf("2026-10-29T00:00:00-05:00", {
        resourceType: RESOURCE_TYPE.CONDITION,
        subject: { display: "Example patient" },
        recordedDate: date,
      });

      expect(() => moveDatesToDay(bundle, LOAD_DAY)).toThrow(
        `${date} cannot move by days`,
      );
    },
  );

  it("refuses a bundle with no timestamp to move dates from", () => {
    const bundle: Bundle = { ...exampleBundle, timestamp: undefined };

    expect(() => moveDatesToDay(bundle, LOAD_DAY)).toThrow(
      "The example bundle needs a timestamp to move dates from.",
    );
  });
});

describe("readPatientName", () => {
  it("reads the first and last name Medplum's invite asks for", () => {
    expect(readPatientName(exampleBundle)).toEqual({
      firstName: "Eleanor",
      lastName: "Walsh",
    });
  });

  it.each([
    ["no name", undefined],
    ["no family name", [{ given: ["Eleanor"] }]],
    ["no given name", [{ family: "Walsh" }]],
  ])("refuses a patient with %s", (_case, name) => {
    expect(() => readPatientName(withPatientName(name))).toThrow(
      "The example patient needs a given and a family name: Medplum's invite asks for both.",
    );
  });
});

describe("assertEveryEntrySucceeded", () => {
  it("accepts a response where every resource was created or updated", () => {
    expect(() =>
      assertEveryEntrySucceeded(
        transactionResponse([responseEntry(created), responseEntry(allOk)]),
      ),
    ).not.toThrow();
  });

  it("names what Medplum refused", () => {
    expect(() =>
      assertEveryEntrySucceeded(
        transactionResponse([
          responseEntry(allOk),
          responseEntry(badRequest("Missing required property")),
        ]),
      ),
    ).toThrow(
      "Medplum refused part of the example data: Missing required property",
    );
  });
});

describe("findPatient", () => {
  it("finds the saved patient in Medplum's response", () => {
    const patient: Patient = { resourceType: RESOURCE_TYPE.PATIENT, id: "1" };

    expect(
      findPatient(
        transactionResponse([
          responseEntry(created, {
            resourceType: RESOURCE_TYPE.ORGANIZATION,
            id: "2",
          }),
          responseEntry(created, patient),
        ]),
      ),
    ).toBe(patient);
  });

  it("refuses a response with no saved patient", () => {
    expect(() =>
      findPatient(
        transactionResponse([
          responseEntry(created, { resourceType: RESOURCE_TYPE.PATIENT }),
        ]),
      ),
    ).toThrow("Medplum's response holds no patient.");
  });
});
