import {
  createReference,
  evalFhirPath,
  formatSearchQuery,
  getExpressionForResourceType,
  getSearchParameter,
  isResource,
  Operator,
  parseSearchRequest,
  splitSearchOnComma,
  toPeriod,
  tryParseReference,
  type Filter,
  type QueryTypes,
  type SearchRequest,
  type WithId,
} from "@medplum/core";
import type {
  AllergyIntolerance,
  Appointment,
  Bundle,
  BundleEntry,
  CarePlan,
  CodeableConcept,
  DiagnosticReport,
  List,
  MedicationRequest,
  Observation,
  Organization,
  Patient,
  Reference,
  Resource,
  ResourceType,
} from "@medplum/fhirtypes";
import { HomerSimpson, MockClient } from "@medplum/mock";
import { onTestFinished, vi } from "vitest";

import {
  ALLERGY_INTOLERANCE_CLINICAL_STATUS,
  ALLERGY_INTOLERANCE_VERIFICATION_STATUS,
  APPOINTMENT_PARTICIPANT_STATUS,
  CARE_PLAN_INTENT,
  CODE_SYSTEM,
  DIAGNOSTIC_REPORT_STATUS,
  IDENTIFIER_SYSTEM,
  LABORATORY_SERVICE_SECTION,
  LIST_MODE,
  LIST_STATUS,
  MEDICATION_REQUEST_INTENT,
  MEDICATION_REQUEST_STATUS,
  OBSERVATION_STATUS,
  RESOURCE_TYPE,
  SEARCH_ENTRY_MODE,
  SEARCH_PARAMETER_TYPE,
} from "./constants/fhir";

export const doctor = { display: "Dr. Mira Synthetic" };

export const laboratory = { display: "Harbor Synthetic Laboratory" };

export const oakDermatology = {
  address: "https://fhir.oak-dermatology.example",
  name: "Oak Synthetic Dermatology",
};

export const mapleDental = {
  address: "https://fhir.maple-dental.example",
  name: "Maple Synthetic Dental",
};

export const harborLaboratory = {
  address: "https://fhir.harbor-laboratory.example",
  name: laboratory.display,
};

export const networkFailure = () => new TypeError("Failed to fetch");

export const newPatient: Patient = {
  resourceType: RESOURCE_TYPE.PATIENT,
  id: "synthetic-new-patient",
  name: [{ given: ["Riley"], family: "Synthetic" }],
};

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
    .spyOn(medplum, "search")
    .mockImplementation(((resourceType, query, options) =>
      shouldFail(readSearchRequest(medplum, resourceType, query))
        ? Promise.reject(networkFailure())
        : MockClient.prototype.search.call(
            medplum,
            resourceType,
            query,
            options,
          )) as typeof medplum.search);

export const interceptSearches = (
  medplum: MockClient,
  intercept: (
    search: () => Promise<Bundle>,
    resourceType: string,
    query: Parameters<MockClient["search"]>[1],
    options: Parameters<MockClient["search"]>[2],
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
        options,
      )) as typeof medplum.search);
};

const EVERY_CANDIDATE_COUNT = 1000;

const listSearchedValues = (
  resource: Resource,
  searchParameterName: string,
): unknown[] => {
  const expression = getSearchParameter(
    resource.resourceType,
    searchParameterName,
  )?.expression;
  const resourceExpression =
    expression &&
    getExpressionForResourceType(resource.resourceType, expression);
  return resourceExpression ? evalFhirPath(resourceExpression, resource) : [];
};

const listCodeNames = (
  resource: Resource,
  searchParameterName: string,
): string[] =>
  (listSearchedValues(resource, searchParameterName) as CodeableConcept[])
    .flatMap(({ coding = [], text }) => [
      text,
      ...coding.map(({ display }) => display),
    ])
    .filter((name): name is string => Boolean(name))
    .map((name) => name.toLowerCase());

// MockClient compares a code exactly and ignores :text, while Medplum's server matches any part of the coded element's text or of a coding's display, ignoring case and the spaces around each value (buildTokenColumnsWhereConditionTextAndContains in token-column.ts).
const matchesCodeTextAsServer = (resource: Resource, { code, value }: Filter) =>
  listCodeNames(resource, code).some((name) =>
    splitSearchOnComma(value).some((text) =>
      name.includes(text.trim().toLowerCase()),
    ),
  );

const hasDateAsServer = (resource: Resource, searchParameterName: string) =>
  listSearchedValues(resource, searchParameterName).some(
    (value) => toPeriod(value) !== undefined,
  );

const matchesMissingDateAsServer = (
  resource: Resource,
  { code, value }: Filter,
) => hasDateAsServer(resource, code) !== (value === String(true));

const isDateParameter = (resourceType: ResourceType, code: string) =>
  getSearchParameter(resourceType, code)?.type === SEARCH_PARAMETER_TYPE.DATE;

const isAnsweredByServerOnly =
  (resourceType: ResourceType) =>
  ({ code, operator }: Filter) =>
    operator === Operator.TEXT ||
    (operator === Operator.MISSING && isDateParameter(resourceType, code));

const matchesAsServer = (resource: Resource, filter: Filter) =>
  filter.operator === Operator.TEXT
    ? matchesCodeTextAsServer(resource, filter)
    : matchesMissingDateAsServer(resource, filter);

const matchesEveryFilterAsServer = (
  resource: Resource | undefined,
  filters: Filter[],
) =>
  resource !== undefined &&
  filters.every((filter) => matchesAsServer(resource, filter));

const isIncludedEntry = ({ search }: BundleEntry) =>
  search?.mode === SEARCH_ENTRY_MODE.INCLUDE;

export const searchAsServer = async (
  medplum: MockClient,
  resourceType: string,
  query: QueryTypes,
  options: Parameters<MockClient["search"]>[2],
): Promise<Bundle> => {
  const searchRequest = readSearchRequest(
    medplum,
    resourceType as ResourceType,
    query,
  );
  const serverOnlyFilters = (searchRequest.filters ?? []).filter(
    isAnsweredByServerOnly(resourceType as ResourceType),
  );
  if (serverOnlyFilters.length === 0) {
    return MockClient.prototype.search.call(
      medplum,
      resourceType as ResourceType,
      query,
      options,
    );
  }
  const everyCandidate = await MockClient.prototype.search.call(
    medplum,
    resourceType as ResourceType,
    formatSearchQuery({
      ...searchRequest,
      filters: searchRequest.filters?.filter(
        (filter) => !serverOnlyFilters.includes(filter),
      ),
      offset: 0,
      count: EVERY_CANDIDATE_COUNT,
    }),
    options,
  );
  const everyEntry = everyCandidate.entry ?? [];
  const matches = everyEntry.filter(
    (entry) =>
      !isIncludedEntry(entry) &&
      matchesEveryFilterAsServer(entry.resource, serverOnlyFilters),
  );
  const offset = searchRequest.offset ?? 0;
  return {
    ...everyCandidate,
    total: matches.length,
    entry: [
      ...matches.slice(
        offset,
        offset + (searchRequest.count ?? matches.length),
      ),
      ...everyEntry.filter(isIncludedEntry),
    ],
  };
};

export const interceptBatches = (
  medplum: MockClient,
  intercept: (executeBatch: () => Promise<Bundle>) => Promise<Bundle>,
) => {
  const executeBatch = medplum.executeBatch.bind(medplum);
  return vi
    .spyOn(medplum, "executeBatch")
    .mockImplementation(((bundle, options) =>
      intercept(() =>
        executeBatch(bundle, options),
      )) as typeof medplum.executeBatch);
};

export const RECEIVED_AT = "2026-10-28T21:10:00.000Z";

export const receiveRecordsAt = (instant: string) => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(instant);
  onTestFinished(() => {
    vi.useRealTimers();
  });
};

export const createRecordSources = async (
  medplum: MockClient,
  sources: (typeof oakDermatology)[],
  subject: Reference<Patient> = createReference(HomerSimpson),
): Promise<List> => {
  const organizations = await Promise.all(
    sources.map(({ address, name }) =>
      medplum.createResource<Organization>({
        resourceType: RESOURCE_TYPE.ORGANIZATION,
        identifier: [{ system: IDENTIFIER_SYSTEM.URI, value: address }],
        name,
      }),
    ),
  );
  return medplum.createResource<List>({
    resourceType: RESOURCE_TYPE.LIST,
    status: LIST_STATUS.CURRENT,
    mode: LIST_MODE.WORKING,
    subject,
    entry: organizations.map((organization) => ({
      item: createReference(organization),
    })),
  });
};

// MockClient leaves out what List:item names, while Medplum's server includes each Organization the patient may read (search-include.ts).
export const addListedOrganizations = async (
  medplum: MockClient,
  bundle: Bundle,
  resourceType: string,
): Promise<Bundle> => {
  if (resourceType !== RESOURCE_TYPE.LIST) {
    return bundle;
  }
  const organizationReferences = (bundle.entry ?? [])
    .flatMap(({ resource }) =>
      isResource<List>(resource, RESOURCE_TYPE.LIST)
        ? (resource.entry ?? [])
        : [],
    )
    .map(({ item }) => item as Reference<Organization>)
    .filter(
      (item) => tryParseReference(item)?.[0] === RESOURCE_TYPE.ORGANIZATION,
    );
  const organizations = await Promise.all(
    organizationReferences.map((item) => medplum.readReference(item)),
  );
  return {
    ...bundle,
    entry: [
      ...(bundle.entry ?? []),
      ...organizations.map((resource) => ({
        resource,
        search: { mode: SEARCH_ENTRY_MODE.INCLUDE },
      })),
    ],
  };
};

export const includeListedOrganizations = (medplum: MockClient) =>
  interceptSearches(medplum, async (search, resourceType) =>
    addListedOrganizations(medplum, await search(), resourceType),
  );
