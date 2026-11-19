import { Operator, type Filter } from "@medplum/core";

import {
  CODE_SYSTEM,
  OBSERVATION_CATEGORY,
  OBSERVATION_STATUS,
  RESOURCE_TYPE,
  SEARCH_PARAMETER,
} from "../../constants/fhir";
import type {
  ListVitalSignsParameters,
  ServiceResponse,
  VitalSignPage,
} from "../../types";
import MedplumService from "../medplum/medplum.service";

export default class ObservationService extends MedplumService {
  listVitalSigns = (
    parameters: ListVitalSignsParameters,
  ): Promise<ServiceResponse<VitalSignPage>> =>
    this.searchPage(
      RESOURCE_TYPE.OBSERVATION,
      {
        dateParameter: SEARCH_PARAMETER.DATE,
        filters: ObservationService.toFilters(parameters),
      },
      parameters.previousPage,
    );

  private static toFilters({
    patientReference,
    recordFilter,
  }: ListVitalSignsParameters): Filter[] {
    return [
      {
        code: SEARCH_PARAMETER.PATIENT,
        operator: Operator.EQUALS,
        value: patientReference,
      },
      {
        code: SEARCH_PARAMETER.CATEGORY,
        operator: Operator.EQUALS,
        value: `${CODE_SYSTEM.OBSERVATION_CATEGORY}|${OBSERVATION_CATEGORY.VITAL_SIGNS}`,
      },
      {
        code: SEARCH_PARAMETER.STATUS,
        operator: Operator.NOT,
        value: OBSERVATION_STATUS.ENTERED_IN_ERROR,
      },
      ...MedplumService.toRecordFilters(recordFilter),
    ];
  }
}
