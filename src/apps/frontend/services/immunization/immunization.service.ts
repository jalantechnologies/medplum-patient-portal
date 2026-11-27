import { Operator, type Filter } from "@medplum/core";

import {
  IMMUNIZATION_STATUS,
  RESOURCE_TYPE,
  SEARCH_PARAMETER,
} from "../../constants/fhir";
import type {
  ImmunizationPage,
  ListImmunizationsParameters,
  ServiceResponse,
} from "../../types";
import MedplumService from "../medplum/medplum.service";

export default class ImmunizationService extends MedplumService {
  listImmunizations = (
    parameters: ListImmunizationsParameters,
  ): Promise<ServiceResponse<ImmunizationPage>> =>
    this.searchPage(
      RESOURCE_TYPE.IMMUNIZATION,
      {
        dateParameter: SEARCH_PARAMETER.DATE,
        filters: ImmunizationService.toFilters(parameters),
      },
      parameters.previousPage,
    );

  private static toFilters({
    patientReference,
    recordFilter,
  }: ListImmunizationsParameters): Filter[] {
    return [
      {
        code: SEARCH_PARAMETER.PATIENT,
        operator: Operator.EQUALS,
        value: patientReference,
      },
      {
        code: SEARCH_PARAMETER.STATUS,
        operator: Operator.NOT,
        value: IMMUNIZATION_STATUS.ENTERED_IN_ERROR,
      },
      ...MedplumService.toRecordFilters(
        recordFilter,
        SEARCH_PARAMETER.VACCINE_CODE,
      ),
    ];
  }
}
