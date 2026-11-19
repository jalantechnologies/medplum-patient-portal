import {
  formatSearchQuery,
  Operator,
  tryParseReference,
  type Filter,
  type IncludeTarget,
  type WithId,
} from "@medplum/core";
import type {
  MedicationRequest,
  Reference,
  Resource,
} from "@medplum/fhirtypes";

import {
  MEDICATION_REQUEST_ELEMENT,
  MEDICATION_REQUEST_INTENT,
  MEDICATION_REQUEST_STATUS,
  REFERENCE_HISTORY_SEGMENT,
  REFERENCE_SEGMENT_SEPARATOR,
  RESOURCE_TYPE,
  SEARCH_PARAMETER,
  SEARCH_VALUE_SEPARATOR,
} from "../../constants/fhir";
import {
  ServiceResponse,
  type ListMedicationRequestsParameters,
  type MedicationRequestPage,
  type MedicationsByReference,
} from "../../types";
import MedplumService from "../medplum/medplum.service";

interface MedicationReference {
  identifier: string;
  reference: string;
  version: string | undefined;
}

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
  private static readonly prescribedMedication: IncludeTarget = {
    resourceType: RESOURCE_TYPE.MEDICATION_REQUEST,
    searchParam: SEARCH_PARAMETER.MEDICATION,
  };

  // FHIR R4 has no search parameter for doNotPerform.
  countActivePrescriptions = async (
    patientReference: string,
  ): Promise<ServiceResponse<number>> => {
    let activePrescriptionCount = 0;
    for await (const page of this.medplumClient.searchResourcePages(
      RESOURCE_TYPE.MEDICATION_REQUEST,
      formatSearchQuery({
        resourceType: RESOURCE_TYPE.MEDICATION_REQUEST,
        fields: [MEDICATION_REQUEST_ELEMENT.DO_NOT_PERFORM],
        filters: MedicationRequestService.buildPrescriptionFilters(
          patientReference,
          [MEDICATION_REQUEST_STATUS.ACTIVE],
        ),
      }),
      MedplumService.freshRequestOptions,
    )) {
      activePrescriptionCount += page.filter(
        ({ doNotPerform }) => !doNotPerform,
      ).length;
    }
    return new ServiceResponse(activePrescriptionCount);
  };

  listMedicationRequests = (
    parameters: ListMedicationRequestsParameters,
  ): Promise<ServiceResponse<MedicationRequestPage>> =>
    this.listPrescriptionsWithStatuses(parameters, LISTED_STATUSES);

  listPastMedicationRequests = (
    parameters: ListMedicationRequestsParameters,
  ): Promise<ServiceResponse<MedicationRequestPage>> =>
    this.listPrescriptionsWithStatuses(parameters, PAST_STATUSES);

  private async listPrescriptionsWithStatuses(
    {
      patientReference,
      previousPage,
      recordFilter,
    }: ListMedicationRequestsParameters,
    statuses: MedicationRequest["status"][],
  ): Promise<ServiceResponse<MedicationRequestPage>> {
    const { includedResources, page } = await this.readNextPage(
      RESOURCE_TYPE.MEDICATION_REQUEST,
      {
        dateParameter: SEARCH_PARAMETER.AUTHORED_ON,
        filters: [
          ...MedicationRequestService.buildPrescriptionFilters(
            patientReference,
            statuses,
          ),
          ...MedplumService.toRecordFilters(recordFilter),
        ],
        include: [MedicationRequestService.prescribedMedication],
      },
      previousPage,
    );
    const medications = await this.addMedications(
      previousPage?.medications ?? new Map(),
      page.resources.slice(previousPage?.resources.length ?? 0),
      includedResources,
    );
    return new ServiceResponse({ ...page, medications });
  }

  // Medplum's _include returns the current version of a medicine, so a prescription that names an earlier version has that version read on its own.
  private async addMedications(
    medications: MedicationsByReference,
    prescriptions: MedicationRequest[],
    includedResources: WithId<Resource>[],
  ): Promise<MedicationsByReference> {
    const references = prescriptions.flatMap(({ medicationReference }) =>
      MedicationRequestService.parseMedicationReference(medicationReference),
    );
    const includedMedications =
      MedicationRequestService.matchIncludedMedications(
        references,
        includedResources,
      );
    const unreadVersions = new Set(
      references
        .filter(
          ({ reference, version }) =>
            version !== undefined &&
            !includedMedications.has(reference) &&
            !medications.has(reference),
        )
        .map(({ reference }) => reference),
    );
    const referencedVersions = await this.readVersions(
      RESOURCE_TYPE.MEDICATION,
      [...unreadVersions],
    );
    return new Map([
      ...medications,
      ...includedMedications,
      ...referencedVersions,
    ]);
  }

  private static parseMedicationReference(
    medicationReference: Reference | undefined,
  ): MedicationReference[] {
    const reference = medicationReference?.reference;
    const [resourceType, identifier] =
      tryParseReference(medicationReference) ?? [];
    if (
      resourceType !== RESOURCE_TYPE.MEDICATION ||
      !identifier ||
      !reference
    ) {
      return [];
    }
    const [, , segment, version] = reference.split(REFERENCE_SEGMENT_SEPARATOR);
    return [
      {
        identifier,
        reference,
        version: segment === REFERENCE_HISTORY_SEGMENT ? version : undefined,
      },
    ];
  }

  private static matchIncludedMedications(
    references: MedicationReference[],
    includedResources: WithId<Resource>[],
  ): MedicationsByReference {
    const includedByIdentifier = new Map(
      includedResources
        .filter((resource) =>
          MedplumService.isOfType(resource, RESOURCE_TYPE.MEDICATION),
        )
        .map((medication) => [medication.id, medication] as const),
    );
    return new Map(
      references.flatMap(({ identifier, reference, version }) => {
        const medication = includedByIdentifier.get(identifier);
        const isReferencedVersion =
          version === undefined || version === medication?.meta?.versionId;
        return medication && isReferencedVersion
          ? [[reference, medication] as const]
          : [];
      }),
    );
  }

  private static buildPrescriptionFilters(
    patientReference: string,
    statuses: MedicationRequest["status"][],
  ): Filter[] {
    return [
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
    ];
  }
}
