import { formatRange, tryParseReference, type WithId } from "@medplum/core";
import type {
  CodeableConcept,
  DiagnosticReport,
  Observation,
  ObservationReferenceRange,
  Reference,
  Resource,
} from "@medplum/fhirtypes";

import {
  CODE_SYSTEM,
  CONTAINED_REFERENCE_PREFIX,
  DIAGNOSTIC_REPORT_KIND,
  OBSERVATION_INTERPRETATION,
  OBSERVATION_INTERPRETATION_VERSION_TWO,
  OBSERVATION_STATUS,
  RESOURCE_TYPE,
} from "../../constants/fhir";
import type {
  DiagnosticReportKind,
  DiagnosticReportPage,
  Measurement,
  RecordSourceNames,
  ResultHolder,
  ResultsByIdentifier,
} from "../../types";
import {
  formatMeasurementValue,
  formatRecordDate,
  humanizeCode,
  nameCodeableConcept,
} from "../../utilities";

const FLAG_SEPARATOR = ", ";
const CONCLUSION_SEPARATOR = ", ";
const QUALIFIER_SEPARATOR = ", ";
const QUALIFIER_LABEL_SEPARATOR = ": ";

const EFFECTIVE_DATE_LABEL = {
  [DIAGNOSTIC_REPORT_KIND.IMAGING]: "Performed",
  [DIAGNOSTIC_REPORT_KIND.LABORATORY]: "Collected",
  [DIAGNOSTIC_REPORT_KIND.OTHER]: "",
} satisfies Record<DiagnosticReportKind, string>;

// HL7 replaced version 2's table 0078 with version 3's ObservationInterpretation in 2015 and kept its codes, so older feeds still send them.
const INTERPRETATION_SYSTEMS: string[] = [
  CODE_SYSTEM.OBSERVATION_INTERPRETATION,
  CODE_SYSTEM.OBSERVATION_INTERPRETATION_VERSION_TWO,
];

const INTERPRETATION_DISPLAY_BY_CODE: ReadonlyMap<string, string> = new Map(
  [
    ...Object.values(OBSERVATION_INTERPRETATION),
    ...Object.values(OBSERVATION_INTERPRETATION_VERSION_TWO),
  ].map(({ code, display }) => [code, display]),
);

export interface TestResultSummary {
  depth: number;
  flag: string;
  referenceRanges: string[];
  status: string;
  test: string;
  value: string;
}

export interface TestReportSummary {
  conclusion: string;
  date: string;
  hasDocument: boolean;
  identifier: string;
  performer: string;
  received: string;
  results: TestResultSummary[];
  source: string;
  sourceUpdated: string;
  status: string;
  title: string;
}

interface MeasurementRow {
  depth: number;
  hasParts: boolean;
  status: string;
}

interface ResultSource {
  holder: ResultHolder;
  results: ResultsByIdentifier;
}

interface FoundResult {
  observation: WithId<Observation>;
  source: ResultSource;
}

const nameInterpretationCode = ({ coding }: CodeableConcept): string => {
  const code = coding?.find(
    ({ system }) =>
      system !== undefined && INTERPRETATION_SYSTEMS.includes(system),
  )?.code;
  return (code && INTERPRETATION_DISPLAY_BY_CODE.get(code)) || "";
};

const nameInterpretation = (interpretation: CodeableConcept): string =>
  nameCodeableConcept(interpretation) ||
  nameInterpretationCode(interpretation) ||
  interpretation.coding?.find(({ code }) => code)?.code ||
  "";

const describeMeasurementValue = (
  measurement: Measurement,
  hasParts: boolean,
): string => {
  const value =
    formatMeasurementValue(measurement) ||
    nameCodeableConcept(measurement.dataAbsentReason);
  if (value || hasParts) {
    return value;
  }
  return "No value";
};

const nameRangeQualifiers = ({
  age,
  appliesTo,
  type,
}: ObservationReferenceRange): string =>
  [
    nameCodeableConcept(type),
    ...(appliesTo ?? []).map(nameCodeableConcept),
    formatRange(age),
  ]
    .filter(Boolean)
    .join(QUALIFIER_SEPARATOR);

const describeReferenceRange = (
  referenceRange: ObservationReferenceRange,
): string => {
  const { high, low, text } = referenceRange;
  const range = text || formatRange({ high, low });
  const qualifiers = nameRangeQualifiers(referenceRange);
  return range && qualifiers
    ? [qualifiers, range].join(QUALIFIER_LABEL_SEPARATOR)
    : range;
};

const summarizeMeasurement = (
  measurement: Measurement,
  { depth, hasParts, status }: MeasurementRow,
): TestResultSummary => ({
  depth,
  flag: (measurement.interpretation ?? [])
    .map(nameInterpretation)
    .filter(Boolean)
    .join(FLAG_SEPARATOR),
  referenceRanges: (measurement.referenceRange ?? [])
    .map(describeReferenceRange)
    .filter(Boolean),
  status,
  test: nameCodeableConcept(measurement.code) || "Test",
  value: describeMeasurementValue(measurement, hasParts),
});

const describeResultStatus = ({ status }: Observation): string =>
  status === OBSERVATION_STATUS.FINAL ? "" : humanizeCode(status);

const summarizeObservation = (
  observation: WithId<Observation>,
  depth: number,
): TestResultSummary[] => {
  // formatMeasurementValue words a result's parts after its own value, and each part gets a row of its own.
  const { component: parts = [], ...ownMeasurement } = observation;
  return [
    summarizeMeasurement(ownMeasurement, {
      depth,
      hasParts: parts.length > 0 || Boolean(observation.hasMember?.length),
      status: describeResultStatus(observation),
    }),
    ...parts.map((part) =>
      summarizeMeasurement(part, {
        depth: depth + 1,
        hasParts: false,
        status: "",
      }),
    ),
  ];
};

const isReadableReference = (reference: Reference): boolean =>
  Boolean(reference.reference?.startsWith(CONTAINED_REFERENCE_PREFIX)) ||
  tryParseReference(reference)?.[0] === RESOURCE_TYPE.OBSERVATION;

const namesResult = ({ display, identifier, reference }: Reference): boolean =>
  Boolean(display || identifier || reference);

const summarizeUnreadableResult = (
  { display }: Reference,
  depth: number,
): TestResultSummary => ({
  depth,
  flag: "",
  referenceRanges: [],
  status: "",
  test: display || "Test",
  value: "Not available here",
});

const isContainedResult =
  (reference: string | undefined) =>
  (resource: Resource): resource is WithId<Observation> =>
    resource.resourceType === RESOURCE_TYPE.OBSERVATION &&
    `${CONTAINED_REFERENCE_PREFIX}${resource.id}` === reference;

const findSharedResult = (
  reference: Reference,
  { results }: ResultSource,
): FoundResult | undefined => {
  const [, identifier] = tryParseReference(reference) ?? [];
  const observation = identifier ? results.get(identifier) : undefined;
  return (
    observation && { observation, source: { holder: observation, results } }
  );
};

const findResult = (
  reference: Reference,
  source: ResultSource,
): FoundResult | undefined => {
  const containedObservation = source.holder.contained?.find(
    isContainedResult(reference.reference),
  );
  const found = containedObservation
    ? { observation: containedObservation, source }
    : findSharedResult(reference, source);
  return found?.observation.status === OBSERVATION_STATUS.ENTERED_IN_ERROR
    ? undefined
    : found;
};

const summarizeResults = (
  references: Reference[] | undefined,
  source: ResultSource,
  ancestors: Observation[],
): TestResultSummary[] =>
  (references ?? []).flatMap((reference) => {
    if (!isReadableReference(reference)) {
      return namesResult(reference)
        ? [summarizeUnreadableResult(reference, ancestors.length)]
        : [];
    }
    const found = findResult(reference, source);
    if (!found || ancestors.includes(found.observation)) {
      return [];
    }
    return [
      ...summarizeObservation(found.observation, ancestors.length),
      ...summarizeResults(found.observation.hasMember, found.source, [
        ...ancestors,
        found.observation,
      ]),
    ];
  });

const findReadableResult = (
  reference: Reference,
  source: ResultSource,
): FoundResult | undefined =>
  isReadableReference(reference) ? findResult(reference, source) : undefined;

const collectMembers = (
  { observation, source }: FoundResult,
  members: Set<Observation> = new Set(),
): Set<Observation> => {
  for (const reference of observation.hasMember ?? []) {
    const member = findReadableResult(reference, source);
    if (member && !members.has(member.observation)) {
      members.add(member.observation);
      collectMembers(member, members);
    }
  }
  return members;
};

const isUnderOtherPanel = (
  observation: Observation,
  membersByPanel: ReadonlyMap<Observation, Set<Observation>>,
): boolean =>
  [...membersByPanel].some(
    ([panel, members]) =>
      members.has(observation) && !membersByPanel.get(observation)?.has(panel),
  );

const listReportResults = (
  references: Reference[] | undefined,
  source: ResultSource,
): Reference[] => {
  const listedResults = (references ?? []).map((reference) => ({
    found: findReadableResult(reference, source),
    reference,
  }));
  const membersByPanel = new Map(
    listedResults.flatMap(({ found }) =>
      found ? [[found.observation, collectMembers(found)] as const] : [],
    ),
  );
  return listedResults
    .filter(
      ({ found }) =>
        !found || !isUnderOtherPanel(found.observation, membersByPanel),
    )
    .map(({ reference }) => reference);
};

const summarizeReportResults = (
  report: DiagnosticReport,
  results: ResultsByIdentifier,
): TestResultSummary[] => {
  const source = { holder: report, results };
  return summarizeResults(listReportResults(report.result, source), source, []);
};

const describeEffectiveDate = (
  { effectiveDateTime, effectivePeriod }: DiagnosticReport,
  kind: DiagnosticReportKind,
): string => {
  const date = formatRecordDate(
    effectiveDateTime ?? effectivePeriod?.start ?? effectivePeriod?.end,
  );
  const label = EFFECTIVE_DATE_LABEL[kind];
  return date && label ? `${label} ${date}` : date;
};

const describeConclusion = ({
  conclusion,
  conclusionCode,
}: DiagnosticReport): string =>
  conclusion ??
  (conclusionCode ?? [])
    .map(nameCodeableConcept)
    .filter(Boolean)
    .join(CONCLUSION_SEPARATOR);

export const summarizeDiagnosticReport =
  (kind: DiagnosticReportKind, recordSourceNames: RecordSourceNames) =>
  (
    report: WithId<DiagnosticReport>,
    { results }: DiagnosticReportPage,
  ): TestReportSummary => ({
    conclusion: describeConclusion(report),
    date: describeEffectiveDate(report, kind),
    hasDocument: Boolean(report.presentedForm?.length),
    identifier: report.id,
    performer: report.performer?.find(({ display }) => display)?.display ?? "",
    received: formatRecordDate(report.meta?.lastUpdated),
    results: summarizeReportResults(report, results),
    source: recordSourceNames.findName(report.meta?.source),
    sourceUpdated: formatRecordDate(report.issued),
    status: humanizeCode(report.status),
    title: nameCodeableConcept(report.code) || "Test report",
  });
