import { Operator } from "@medplum/core";

import {
  CARE_PLAN_STATUS,
  RESOURCE_TYPE,
  SEARCH_PARAMETER,
} from "../../constants/fhir";
import { ServiceResponse } from "../../types";
import MedplumService from "../medplum/medplum.service";

export default class CarePlanService extends MedplumService {
  countActiveCarePlans = async (
    patientReference: string,
  ): Promise<ServiceResponse<number>> =>
    new ServiceResponse(
      await this.countResources(RESOURCE_TYPE.CARE_PLAN, [
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
      ]),
    );
}
