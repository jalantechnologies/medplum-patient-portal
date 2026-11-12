import type { WithId } from "@medplum/core";
import type { DiagnosticReport, Observation } from "@medplum/fhirtypes";

import type { DIAGNOSTIC_REPORT_KIND } from "../constants/fhir";
import type { Nullable } from "./common";
import type { RecordSearch } from "./record-list-tab";
import type { SearchPage } from "./search-page";

export type DiagnosticReportKind =
  (typeof DIAGNOSTIC_REPORT_KIND)[keyof typeof DIAGNOSTIC_REPORT_KIND];

export type ResultHolder = DiagnosticReport | Observation;

export type ResultsByIdentifier = ReadonlyMap<string, WithId<Observation>>;

export interface DiagnosticReportPage extends SearchPage<
  WithId<DiagnosticReport>
> {
  results: ResultsByIdentifier;
}

export type DiagnosticReportSearch = RecordSearch<
  WithId<DiagnosticReport>,
  DiagnosticReportPage
>;

export interface ListDiagnosticReportsParameters {
  kind: DiagnosticReportKind;
  patientReference: string;
  previousPage: Nullable<DiagnosticReportPage>;
}
