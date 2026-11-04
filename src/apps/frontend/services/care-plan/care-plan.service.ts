import { formatSearchQuery, Operator, type SearchRequest } from "@medplum/core";
import type { CarePlan } from "@medplum/fhirtypes";

import constant from "../../constants";
import {
  CARE_PLAN_STATUS,
  RESOURCE_TYPE,
  SEARCH_PARAMETER,
  SEARCH_TOTAL,
} from "../../constants/fhir";
import { AsynchronousOperationError, ServiceResponse } from "../../types";
import MedplumService from "../medplum/medplum.service";

export default class CarePlanService extends MedplumService {
  countActiveCarePlans = async (
    patientReference: string,
  ): Promise<ServiceResponse<number>> => {
    const searchRequest: SearchRequest<CarePlan> = {
      resourceType: RESOURCE_TYPE.CARE_PLAN,
      filters: [
        {
          code: SEARCH_PARAMETER.SUBJECT,
          operator: Operator.EQUALS,
          value: patientReference,
        },
        {
          code: SEARCH_PARAMETER.STATUS,
          operator: Operator.EQUALS,
          value: CARE_PLAN_STATUS.ACTIVE,
        },
      ],
      count: 0,
      total: SEARCH_TOTAL.ACCURATE,
    };
    const bundle = await this.medplumClient.search(
      searchRequest.resourceType,
      formatSearchQuery(searchRequest),
      MedplumService.freshRequestOptions,
    );
    if (bundle.total === undefined) {
      throw new AsynchronousOperationError(constant.DEFAULT_ERROR_MESSAGE);
    }
    return new ServiceResponse(bundle.total);
  };
}
