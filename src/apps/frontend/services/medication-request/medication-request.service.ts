import { Operator, type WithId } from "@medplum/core";
import type { MedicationRequest } from "@medplum/fhirtypes";

import {
  MEDICATION_REQUEST_INTENT,
  MEDICATION_REQUEST_STATUS,
  RESOURCE_TYPE,
  SEARCH_PARAMETER,
  SEARCH_VALUE_SEPARATOR,
} from "../../constants/fhir";
import type { Nullable, SearchPage, ServiceResponse } from "../../types";
import MedplumService from "../medplum/medplum.service";

type MedicationRequestPage = SearchPage<WithId<MedicationRequest>>;

// A proposal or a plan was never prescribed, and a filler order or an instance order repeats an order that is already listed.
const PRESCRIPTION_INTENTS = [
  MEDICATION_REQUEST_INTENT.ORDER,
  MEDICATION_REQUEST_INTENT.ORIGINAL_ORDER,
  MEDICATION_REQUEST_INTENT.REFLEX_ORDER,
];

const LISTED_STATUSES = [
  MEDICATION_REQUEST_STATUS.ACTIVE,
  MEDICATION_REQUEST_STATUS.ON_HOLD,
  MEDICATION_REQUEST_STATUS.COMPLETED,
  MEDICATION_REQUEST_STATUS.STOPPED,
  MEDICATION_REQUEST_STATUS.CANCELLED,
  MEDICATION_REQUEST_STATUS.UNKNOWN,
];

const PAST_STATUSES = [
  MEDICATION_REQUEST_STATUS.COMPLETED,
  MEDICATION_REQUEST_STATUS.STOPPED,
];

export default class MedicationRequestService extends MedplumService {
  listMedicationRequests = (
    patientReference: string,
    previousPage: Nullable<MedicationRequestPage> = null,
  ): Promise<ServiceResponse<MedicationRequestPage>> =>
    this.listPrescriptionsWithStatuses(
      patientReference,
      LISTED_STATUSES,
      previousPage,
    );

  listPastMedicationRequests = (
    patientReference: string,
    previousPage: Nullable<MedicationRequestPage> = null,
  ): Promise<ServiceResponse<MedicationRequestPage>> =>
    this.listPrescriptionsWithStatuses(
      patientReference,
      PAST_STATUSES,
      previousPage,
    );

  private listPrescriptionsWithStatuses(
    patientReference: string,
    statuses: MedicationRequest["status"][],
    previousPage: Nullable<MedicationRequestPage>,
  ): Promise<ServiceResponse<MedicationRequestPage>> {
    return this.searchPage(
      RESOURCE_TYPE.MEDICATION_REQUEST,
      {
        dateParameter: SEARCH_PARAMETER.AUTHORED_ON,
        filters: [
          {
            code: SEARCH_PARAMETER.PATIENT,
            operator: Operator.EQUALS,
            value: patientReference,
          },
          {
            code: SEARCH_PARAMETER.INTENT,
            operator: Operator.EQUALS,
            value: PRESCRIPTION_INTENTS.join(SEARCH_VALUE_SEPARATOR),
          },
          {
            code: SEARCH_PARAMETER.STATUS,
            operator: Operator.EQUALS,
            value: statuses.join(SEARCH_VALUE_SEPARATOR),
          },
        ],
      },
      previousPage,
    );
  }
}
