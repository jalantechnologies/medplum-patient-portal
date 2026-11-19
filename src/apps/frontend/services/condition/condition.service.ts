import { Operator, type Filter } from "@medplum/core";

import {
  CONDITION_VERIFICATION_STATUS,
  RESOURCE_TYPE,
  SEARCH_PARAMETER,
} from "../../constants/fhir";
import type {
  ConditionPage,
  ListConditionsParameters,
  ServiceResponse,
} from "../../types";
import MedplumService from "../medplum/medplum.service";

export default class ConditionService extends MedplumService {
  listConditions = (
    parameters: ListConditionsParameters,
  ): Promise<ServiceResponse<ConditionPage>> =>
    this.searchPage(
      RESOURCE_TYPE.CONDITION,
      {
        dateParameter: SEARCH_PARAMETER.RECORDED_DATE,
        filters: ConditionService.toFilters(parameters),
      },
      parameters.previousPage,
    );

  private static toFilters({
    patientReference,
    recordFilter,
  }: ListConditionsParameters): Filter[] {
    return [
      {
        code: SEARCH_PARAMETER.PATIENT,
        operator: Operator.EQUALS,
        value: patientReference,
      },
      {
        code: SEARCH_PARAMETER.VERIFICATION_STATUS,
        operator: Operator.NOT,
        value: CONDITION_VERIFICATION_STATUS.ENTERED_IN_ERROR,
      },
      ...MedplumService.toRecordFilters(recordFilter),
    ];
  }
}
