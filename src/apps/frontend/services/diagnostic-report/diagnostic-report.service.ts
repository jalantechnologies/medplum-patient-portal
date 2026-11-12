import { Operator, tryParseReference, type Filter } from "@medplum/core";
import type { Observation, Reference, Resource } from "@medplum/fhirtypes";

import {
  DIAGNOSTIC_REPORT_CATEGORY,
  DIAGNOSTIC_REPORT_KIND,
  DIAGNOSTIC_REPORT_STATUS,
  OBSERVATION_STATUS,
  RESOURCE_TYPE,
  SEARCH_PARAMETER,
  SEARCH_VALUE_SEPARATOR,
} from "../../constants/fhir";
import {
  ServiceResponse,
  type DiagnosticReportKind,
  type DiagnosticReportPage,
  type ListDiagnosticReportsParameters,
  type ResultHolder,
  type ResultsByIdentifier,
} from "../../types";
import MedplumService from "../medplum/medplum.service";

export default class DiagnosticReportService extends MedplumService {
  private static readonly resultFilters: Filter[] = [
    {
      code: SEARCH_PARAMETER.STATUS,
      operator: Operator.NOT,
      value: OBSERVATION_STATUS.ENTERED_IN_ERROR,
    },
  ];

  listReports = async (
    parameters: ListDiagnosticReportsParameters,
  ): Promise<ServiceResponse<DiagnosticReportPage>> => {
    const { previousPage } = parameters;
    const page = await this.readNextPage(
      RESOURCE_TYPE.DIAGNOSTIC_REPORT,
      {
        dateParameter: SEARCH_PARAMETER.DATE,
        filters: DiagnosticReportService.toFilters(parameters),
      },
      previousPage,
    );
    const newReports = page.resources.slice(
      previousPage?.resources.length ?? 0,
    );
    const results = await this.addResults(
      previousPage?.results ?? new Map(),
      newReports.flatMap(DiagnosticReportService.listResultReferences),
    );
    return new ServiceResponse({ ...page, results });
  };

  private static toFilters({
    kind,
    patientReference,
  }: ListDiagnosticReportsParameters): Filter[] {
    const categoryFilterByKind = {
      [DIAGNOSTIC_REPORT_KIND.IMAGING]: {
        operator: Operator.EQUALS,
        categories: DIAGNOSTIC_REPORT_CATEGORY.IMAGING,
      },
      [DIAGNOSTIC_REPORT_KIND.LABORATORY]: {
        operator: Operator.EQUALS,
        categories: DIAGNOSTIC_REPORT_CATEGORY.LABORATORY,
      },
      [DIAGNOSTIC_REPORT_KIND.OTHER]: {
        operator: Operator.NOT,
        categories: [
          ...DIAGNOSTIC_REPORT_CATEGORY.IMAGING,
          ...DIAGNOSTIC_REPORT_CATEGORY.LABORATORY,
        ],
      },
    } satisfies Record<
      DiagnosticReportKind,
      { operator: Operator; categories: readonly string[] }
    >;
    const { categories, operator } = categoryFilterByKind[kind];
    return [
      {
        code: SEARCH_PARAMETER.PATIENT,
        operator: Operator.EQUALS,
        value: patientReference,
      },
      {
        code: SEARCH_PARAMETER.STATUS,
        operator: Operator.NOT,
        value: DIAGNOSTIC_REPORT_STATUS.ENTERED_IN_ERROR,
      },
      {
        code: SEARCH_PARAMETER.CATEGORY,
        operator,
        value: categories.join(SEARCH_VALUE_SEPARATOR),
      },
    ];
  }

  // Medplum fails a search with _include once the matches and the included resources pass 1,000, which a page of reports with ten results each reaches, so the results are searched for by identifier.
  private async addResults(
    results: ResultsByIdentifier,
    references: Reference[],
  ): Promise<ResultsByIdentifier> {
    const identifiers = DiagnosticReportService.listObservationIdentifiers(
      references,
    ).filter((identifier) => !results.has(identifier));
    if (identifiers.length === 0) {
      return results;
    }
    const observations = await this.searchByIdentifiers(
      RESOURCE_TYPE.OBSERVATION,
      identifiers,
      DiagnosticReportService.resultFilters,
    );
    return this.addResults(
      new Map([
        ...results,
        ...observations.map(
          (observation) => [observation.id, observation] as const,
        ),
      ]),
      observations.flatMap(DiagnosticReportService.listResultReferences),
    );
  }

  private static listResultReferences(holder: ResultHolder): Reference[] {
    return [
      holder,
      ...(holder.contained ?? []).filter(DiagnosticReportService.isObservation),
    ].flatMap(DiagnosticReportService.listOwnResultReferences);
  }

  private static listOwnResultReferences(holder: ResultHolder): Reference[] {
    return (
      (holder.resourceType === RESOURCE_TYPE.DIAGNOSTIC_REPORT
        ? holder.result
        : holder.hasMember) ?? []
    );
  }

  private static isObservation(resource: Resource): resource is Observation {
    return resource.resourceType === RESOURCE_TYPE.OBSERVATION;
  }

  private static listObservationIdentifiers(references: Reference[]): string[] {
    const identifiers = references.flatMap((reference) => {
      const [resourceType, identifier] = tryParseReference(reference) ?? [];
      return resourceType === RESOURCE_TYPE.OBSERVATION && identifier
        ? [identifier]
        : [];
    });
    return [...new Set(identifiers)];
  }
}
