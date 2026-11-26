import { Operator, type Filter } from "@medplum/core";

import {
  PROCEDURE_STATUS,
  RESOURCE_TYPE,
  SEARCH_PARAMETER,
} from "../../constants/fhir";
import type {
  ListProceduresParameters,
  ProcedurePage,
  ServiceResponse,
} from "../../types";
import MedplumService from "../medplum/medplum.service";

export default class ProcedureService extends MedplumService {
  listProcedures = (
    parameters: ListProceduresParameters,
  ): Promise<ServiceResponse<ProcedurePage>> =>
    this.searchPage(
      RESOURCE_TYPE.PROCEDURE,
      {
        dateParameter: SEARCH_PARAMETER.DATE,
        filters: ProcedureService.toFilters(parameters),
      },
      parameters.previousPage,
    );

  private static toFilters({
    patientReference,
    recordFilter,
  }: ListProceduresParameters): Filter[] {
    return [
      {
        code: SEARCH_PARAMETER.PATIENT,
        operator: Operator.EQUALS,
        value: patientReference,
      },
      {
        code: SEARCH_PARAMETER.STATUS,
        operator: Operator.NOT,
        value: PROCEDURE_STATUS.ENTERED_IN_ERROR,
      },
      ...MedplumService.toRecordFilters(recordFilter),
    ];
  }
}
