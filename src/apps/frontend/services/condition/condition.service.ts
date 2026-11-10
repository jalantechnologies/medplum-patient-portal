import { Operator, type WithId } from "@medplum/core";
import type { Condition } from "@medplum/fhirtypes";

import {
  CONDITION_VERIFICATION_STATUS,
  RESOURCE_TYPE,
  SEARCH_PARAMETER,
} from "../../constants/fhir";
import type { Nullable, SearchPage, ServiceResponse } from "../../types";
import MedplumService from "../medplum/medplum.service";

export default class ConditionService extends MedplumService {
  listConditions = (
    patientReference: string,
    previousPage: Nullable<SearchPage<WithId<Condition>>> = null,
  ): Promise<ServiceResponse<SearchPage<WithId<Condition>>>> =>
    this.searchPage(
      RESOURCE_TYPE.CONDITION,
      {
        dateParameter: SEARCH_PARAMETER.RECORDED_DATE,
        filters: [
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
        ],
      },
      previousPage,
    );
}
