import { Operator, type Filter, type WithId } from "@medplum/core";
import type { AllergyIntolerance } from "@medplum/fhirtypes";

import {
  ALLERGY_INTOLERANCE_CLINICAL_STATUS,
  ALLERGY_INTOLERANCE_VERIFICATION_STATUS,
  RESOURCE_TYPE,
  SEARCH_PARAMETER,
  SEARCH_VALUE_SEPARATOR,
} from "../../constants/fhir";
import {
  ServiceResponse,
  type ActiveAllergyIntolerancePreview,
  type Nullable,
  type SearchPage,
} from "../../types";
import MedplumService from "../medplum/medplum.service";

type AllergyIntoleranceVerificationStatus =
  (typeof ALLERGY_INTOLERANCE_VERIFICATION_STATUS)[keyof typeof ALLERGY_INTOLERANCE_VERIFICATION_STATUS];

const RULED_OUT_VERIFICATION_STATUSES = [
  ALLERGY_INTOLERANCE_VERIFICATION_STATUS.REFUTED,
  ALLERGY_INTOLERANCE_VERIFICATION_STATUS.ENTERED_IN_ERROR,
];

export default class AllergyIntoleranceService extends MedplumService {
  listAllergyIntolerances = (
    patientReference: string,
    previousPage: Nullable<SearchPage<WithId<AllergyIntolerance>>> = null,
  ): Promise<ServiceResponse<SearchPage<WithId<AllergyIntolerance>>>> =>
    this.searchPage(
      RESOURCE_TYPE.ALLERGY_INTOLERANCE,
      {
        dateParameter: SEARCH_PARAMETER.DATE,
        filters:
          AllergyIntoleranceService.buildRecordedFilters(patientReference),
      },
      previousPage,
    );

  previewActiveAllergyIntolerances = async (
    patientReference: string,
  ): Promise<ServiceResponse<ActiveAllergyIntolerancePreview>> => {
    const activePreview = await this.searchPreview(
      RESOURCE_TYPE.ALLERGY_INTOLERANCE,
      {
        dateParameter: SEARCH_PARAMETER.DATE,
        filters: AllergyIntoleranceService.buildActiveFilters(patientReference),
      },
    );
    const hasRecordedAllergyIntolerances =
      activePreview.total > 0 ||
      (await this.countResources(
        RESOURCE_TYPE.ALLERGY_INTOLERANCE,
        AllergyIntoleranceService.buildRecordedFilters(patientReference),
      )) > 0;
    return new ServiceResponse({
      ...activePreview,
      hasRecordedAllergyIntolerances,
    });
  };

  private static buildRecordedFilters(patientReference: string): Filter[] {
    return AllergyIntoleranceService.buildFiltersLeavingOut(patientReference, [
      ALLERGY_INTOLERANCE_VERIFICATION_STATUS.ENTERED_IN_ERROR,
    ]);
  }

  private static buildActiveFilters(patientReference: string): Filter[] {
    return [
      ...AllergyIntoleranceService.buildFiltersLeavingOut(
        patientReference,
        RULED_OUT_VERIFICATION_STATUSES,
      ),
      {
        code: SEARCH_PARAMETER.CLINICAL_STATUS,
        operator: Operator.EQUALS,
        value: ALLERGY_INTOLERANCE_CLINICAL_STATUS.ACTIVE,
      },
    ];
  }

  private static buildFiltersLeavingOut(
    patientReference: string,
    verificationStatuses: AllergyIntoleranceVerificationStatus[],
  ): Filter[] {
    return [
      {
        code: SEARCH_PARAMETER.PATIENT,
        operator: Operator.EQUALS,
        value: patientReference,
      },
      {
        code: SEARCH_PARAMETER.VERIFICATION_STATUS,
        operator: Operator.NOT,
        value: verificationStatuses.join(SEARCH_VALUE_SEPARATOR),
      },
    ];
  }
}
