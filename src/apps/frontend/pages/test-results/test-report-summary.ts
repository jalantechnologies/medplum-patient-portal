import {
  formatObservationValue,
  formatQuantity,
  formatRange,
  formatWallTime,
  tryParseReference,
  type WithId,
} from "@medplum/core";
import type {
  CodeableConcept,
  DiagnosticReport,
  Observation,
  ObservationComponent,
  ObservationReferenceRange,
  Period,
  Ratio,
  Reference,
  Resource,
} from "@medplum/fhirtypes";

import constant from "../../constants";
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
  ResultHolder,
  ResultsByIdentifier,
} from "../../types";
import {
  formatRecordDate,
  humanizeCode,
  nameCodeableConcept,
} from "../../utilities";

const FLAG_SEPARATOR = ", ";
const RATIO_SEPARATOR = ":";
const RANGE_SEPARATOR = " - ";
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
  results: TestResultSummary[];
  status: string;
  title: string;
}

type Measurement = Observation | ObservationComponent;

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

const formatRatio = ({ denominator, numerator }: Ratio): string =>
  [formatQuantity(numerator), formatQuantity(denominator)].join(
    RATIO_SEPARATOR,
  );

// Medplum's formatPeriod reads a calendar date in UTC and adds a time of day, which moves it to the day before west of UTC.
const formatPeriodValue = ({ end, start }: Period): string => {
  const startDate = formatRecordDate(start);
  const endDate = formatRecordDate(end);
  if (startDate && endDate) {
    return [startDate, endDate].join(RANGE_SEPARATOR);
  }
  if (startDate) {
    return `From ${startDate}`;
  }
  return endDate && `Until ${endDate}`;
};

// Medplum's formatObservationValue words a value only when it is a quantity, a coded value or text.
const formatOtherValue = (measurement: Measurement): string => {
  if (measurement.valueInteger !== undefined) {
    return String(measurement.valueInteger);
  }
  if (measurement.valueBoolean !== undefined) {
    return measurement.valueBoolean ? "Yes" : "No";
  }
  if (measurement.valueRatio) {
    return formatRatio(measurement.valueRatio);
  }
  if (measurement.valueRange) {
    return formatRange(measurement.valueRange);
  }
  if (measurement.valuePeriod) {
    return formatPeriodValue(measurement.valuePeriod);
  }
  if (measurement.valueSampledData) {
    return "Device recording, not shown here";
  }
  return (
    formatRecordDate(measurement.valueDateTime) ||
    formatWallTime(measurement.valueTime, constant.LOCALE)
  );
};

const formatMeasurementValue = (
  measurement: Measurement,
  hasParts: boolean,
): string => {
  const value =
    formatObservationValue(measurement) ||
    formatOtherValue(measurement) ||
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
  value: formatMeasurementValue(measurement, hasParts),
});

const describeResultStatus = ({ status }: Observation): string =>
  status === OBSERVATION_STATUS.FINAL ? "" : humanizeCode(status);

const summarizeObservation = (
  observation: WithId<Observation>,
  depth: number,
): TestResultSummary[] => {
  // Medplum's formatObservationValue words a result's parts after its own value, and each part gets a row of its own.
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

export const summarizeDiagnosticReport =
  (kind: DiagnosticReportKind) =>
  (
    report: WithId<DiagnosticReport>,
    { results }: DiagnosticReportPage,
  ): TestReportSummary => ({
    conclusion: report.conclusion ?? "",
    date: describeEffectiveDate(report, kind),
    hasDocument: Boolean(report.presentedForm?.length),
    identifier: report.id,
    performer: report.performer?.find(({ display }) => display)?.display ?? "",
    results: summarizeResults(report.result, { holder: report, results }, []),
    status: humanizeCode(report.status),
    title: nameCodeableConcept(report.code) || "Test report",
  });
