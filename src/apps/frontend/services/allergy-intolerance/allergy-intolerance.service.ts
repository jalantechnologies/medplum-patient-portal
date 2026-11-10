import { Operator, type WithId } from "@medplum/core";
import type { AllergyIntolerance } from "@medplum/fhirtypes";

import {
  ALLERGY_INTOLERANCE_VERIFICATION_STATUS,
  RESOURCE_TYPE,
  SEARCH_PARAMETER,
} from "../../constants/fhir";
import type { Nullable, SearchPage, ServiceResponse } from "../../types";
import MedplumService from "../medplum/medplum.service";

export default class AllergyIntoleranceService extends MedplumService {
  listAllergyIntolerances = (
    patientReference: string,
    previousPage: Nullable<SearchPage<WithId<AllergyIntolerance>>> = null,
  ): Promise<ServiceResponse<SearchPage<WithId<AllergyIntolerance>>>> =>
    this.searchPage(
      RESOURCE_TYPE.ALLERGY_INTOLERANCE,
      {
        dateParameter: SEARCH_PARAMETER.DATE,
        filters: [
          {
            code: SEARCH_PARAMETER.PATIENT,
            operator: Operator.EQUALS,
            value: patientReference,
          },
          {
            code: SEARCH_PARAMETER.VERIFICATION_STATUS,
            operator: Operator.NOT,
            value: ALLERGY_INTOLERANCE_VERIFICATION_STATUS.ENTERED_IN_ERROR,
          },
        ],
      },
      previousPage,
    );
}
