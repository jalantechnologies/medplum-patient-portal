import { formatSearchQuery, Operator, type SearchRequest } from "@medplum/core";
import type { Appointment } from "@medplum/fhirtypes";

import {
  APPOINTMENT_STATUS,
  RESOURCE_TYPE,
  SEARCH_PARAMETER,
} from "../../constants/fhir";
import { ServiceResponse } from "../../types";
import MedplumService from "../medplum/medplum.service";

export default class AppointmentService extends MedplumService {
  getNextAppointment = async (
    patientReference: string,
  ): Promise<ServiceResponse<Appointment>> => {
    const searchRequest: SearchRequest<Appointment> = {
      resourceType: RESOURCE_TYPE.APPOINTMENT,
      filters: [
        {
          code: SEARCH_PARAMETER.PATIENT,
          operator: Operator.EQUALS,
          value: patientReference,
        },
        {
          code: SEARCH_PARAMETER.STATUS,
          operator: Operator.EQUALS,
          value: APPOINTMENT_STATUS.BOOKED,
        },
        {
          code: SEARCH_PARAMETER.DATE,
          operator: Operator.GREATER_THAN_OR_EQUALS,
          value: new Date().toISOString(),
        },
      ],
      sortRules: [{ code: SEARCH_PARAMETER.DATE }],
    };
    const appointment = await this.medplumClient.searchOne(
      searchRequest.resourceType,
      formatSearchQuery(searchRequest),
      MedplumService.freshRequestOptions,
    );
    return new ServiceResponse(appointment);
  };
}
