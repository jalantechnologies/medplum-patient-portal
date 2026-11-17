import { Operator, type Filter, type WithId } from "@medplum/core";
import type { CarePlan } from "@medplum/fhirtypes";

import constant from "../../constants";
import {
  CARE_PLAN_INTENT,
  CARE_PLAN_STATUS,
  RESOURCE_TYPE,
  SEARCH_PARAMETER,
  SEARCH_VALUE_SEPARATOR,
} from "../../constants/fhir";
import {
  ServiceResponse,
  type ListCarePlanPreviewParameters,
} from "../../types";
import MedplumService from "../medplum/medplum.service";

interface StatusSelection {
  operator: Operator;
  statuses: CarePlan["status"][];
}

// A proposal or an option was only suggested to the patient, never agreed, so it is not care the patient is under.
const AGREED_INTENTS = [CARE_PLAN_INTENT.PLAN, CARE_PLAN_INTENT.ORDER];

const ONGOING_STATUSES: StatusSelection = {
  operator: Operator.EQUALS,
  statuses: [CARE_PLAN_STATUS.ACTIVE],
};

// A draft is not yet meant to be acted on.
const OTHER_LISTED_STATUSES: StatusSelection = {
  operator: Operator.NOT,
  statuses: [
    CARE_PLAN_STATUS.ACTIVE,
    CARE_PLAN_STATUS.DRAFT,
    CARE_PLAN_STATUS.ENTERED_IN_ERROR,
  ],
};

export default class CarePlanService extends MedplumService {
  countActiveCarePlans = async (
    patientReference: string,
  ): Promise<ServiceResponse<number>> =>
    new ServiceResponse(
      await this.countResources(RESOURCE_TYPE.CARE_PLAN, [
        CarePlanService.toPatientFilter(patientReference),
        {
          code: SEARCH_PARAMETER.STATUS,
          operator: Operator.EQUALS,
          value: CARE_PLAN_STATUS.ACTIVE,
        },
      ]),
    );

  listCarePlanPreview = async (
    parameters: ListCarePlanPreviewParameters,
  ): Promise<ServiceResponse<WithId<CarePlan>[]>> => {
    const ongoingCarePlans = await this.listNewestCarePlans(
      parameters,
      ONGOING_STATUSES,
    );
    const otherCarePlans =
      ongoingCarePlans.length < constant.SEARCH_PREVIEW_SIZE
        ? await this.listNewestCarePlans(parameters, OTHER_LISTED_STATUSES)
        : [];
    return new ServiceResponse(
      CarePlanService.listEachOnce([
        ...ongoingCarePlans,
        ...otherCarePlans,
      ]).slice(0, constant.SEARCH_PREVIEW_SIZE),
    );
  };

  private listNewestCarePlans(
    parameters: ListCarePlanPreviewParameters,
    statusSelection: StatusSelection,
  ): Promise<WithId<CarePlan>[]> {
    return this.listNewest(
      RESOURCE_TYPE.CARE_PLAN,
      {
        dateParameter: SEARCH_PARAMETER.DATE,
        filters: CarePlanService.toFilters(parameters, statusSelection),
      },
      constant.SEARCH_PREVIEW_SIZE,
    );
  }

  private static toFilters(
    { patientReference }: ListCarePlanPreviewParameters,
    { operator, statuses }: StatusSelection,
  ): Filter[] {
    return [
      CarePlanService.toPatientFilter(patientReference),
      {
        code: SEARCH_PARAMETER.INTENT,
        operator: Operator.EQUALS,
        value: AGREED_INTENTS.join(SEARCH_VALUE_SEPARATOR),
      },
      {
        code: SEARCH_PARAMETER.STATUS,
        operator,
        value: statuses.join(SEARCH_VALUE_SEPARATOR),
      },
    ];
  }

  private static toPatientFilter(patientReference: string): Filter {
    return {
      code: SEARCH_PARAMETER.SUBJECT,
      operator: Operator.EQUALS,
      value: patientReference,
    };
  }

  // A plan whose status or period changes between two of the searches comes back from both.
  private static listEachOnce(
    carePlans: WithId<CarePlan>[],
  ): WithId<CarePlan>[] {
    return carePlans.filter(
      (carePlan, index) =>
        carePlans.findIndex(({ id }) => id === carePlan.id) === index,
    );
  }
}
