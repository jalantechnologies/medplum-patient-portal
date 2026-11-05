import { Operator, type WithId } from "@medplum/core";
import type { Observation } from "@medplum/fhirtypes";

import {
  CODE_SYSTEM,
  OBSERVATION_CATEGORY,
  OBSERVATION_STATUS,
  RESOURCE_TYPE,
  SEARCH_PARAMETER,
} from "../../constants/fhir";
import type { Nullable, SearchPage, ServiceResponse } from "../../types";
import MedplumService from "../medplum/medplum.service";

export default class ObservationService extends MedplumService {
  listVitalSigns = (
    patientReference: string,
    previousPage: Nullable<SearchPage<WithId<Observation>>> = null,
  ): Promise<ServiceResponse<SearchPage<WithId<Observation>>>> =>
    this.searchPage(
      RESOURCE_TYPE.OBSERVATION,
      {
        filters: [
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
        ],
        sortRules: [{ code: SEARCH_PARAMETER.DATE, descending: true }],
      },
      previousPage,
    );
}
