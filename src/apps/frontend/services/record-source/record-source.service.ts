import {
  formatSearchQuery,
  getReferenceString,
  isResource,
  Operator,
  type IncludeTarget,
  type SearchRequest,
} from "@medplum/core";
import type { List, Organization, Resource } from "@medplum/fhirtypes";

import constant from "../../constants";
import {
  IDENTIFIER_SYSTEM,
  LIST_MODE,
  LIST_STATUS,
  RESOURCE_TYPE,
  SEARCH_PARAMETER,
} from "../../constants/fhir";
import {
  RecordSourceNames,
  ServiceResponse,
  type ListRecordSourcesParameters,
} from "../../types";
import MedplumService from "../medplum/medplum.service";

type SourceName = [address: string, name: string];

export default class RecordSourceService extends MedplumService {
  private static readonly listedOrganization: IncludeTarget = {
    resourceType: RESOURCE_TYPE.LIST,
    searchParam: SEARCH_PARAMETER.ITEM,
    targetType: RESOURCE_TYPE.ORGANIZATION,
  };

  listRecordSourceNames = async (
    parameters: ListRecordSourcesParameters,
  ): Promise<ServiceResponse<RecordSourceNames>> => {
    const searchRequest = RecordSourceService.toSearchRequest(parameters);
    const resources: Resource[] = [];
    for await (const page of this.medplumClient.searchResourcePages(
      searchRequest.resourceType,
      formatSearchQuery(searchRequest),
      MedplumService.freshRequestOptions,
    )) {
      resources.push(...page);
    }
    return new ServiceResponse(
      new RecordSourceNames(RecordSourceService.nameListedSources(resources)),
    );
  };

  private static toSearchRequest({
    patientReference,
  }: ListRecordSourcesParameters): SearchRequest<List> {
    return {
      resourceType: RESOURCE_TYPE.LIST,
      filters: [
        {
          code: SEARCH_PARAMETER.SUBJECT,
          operator: Operator.EQUALS,
          value: patientReference,
        },
        {
          code: SEARCH_PARAMETER.STATUS,
          operator: Operator.EQUALS,
          value: LIST_STATUS.CURRENT,
        },
      ],
      include: [RecordSourceService.listedOrganization],
      count: constant.SEARCH_PAGE_SIZE,
    };
  }

  private static nameListedSources(resources: Resource[]): SourceName[] {
    const organizationsByReference = new Map(
      resources
        .filter((resource) =>
          isResource<Organization>(resource, RESOURCE_TYPE.ORGANIZATION),
        )
        .map((organization) => [
          getReferenceString(organization),
          organization,
        ]),
    );
    return resources
      .filter(RecordSourceService.isWorkingList)
      .flatMap(({ entry }) => entry ?? [])
      .flatMap(({ item }) => {
        const organization = organizationsByReference.get(item.reference ?? "");
        return organization
          ? RecordSourceService.nameAddresses(organization)
          : [];
      });
  }

  // A snapshot list may be out of date, and a list of changes holds additions and removals (FHIR allows an entry marked deleted only there), not the sources themselves.
  private static isWorkingList(resource: Resource): resource is List {
    return (
      isResource<List>(resource, RESOURCE_TYPE.LIST) &&
      resource.mode === LIST_MODE.WORKING
    );
  }

  private static nameAddresses({
    identifier,
    name,
  }: Organization): SourceName[] {
    if (!name) {
      return [];
    }
    return (identifier ?? []).flatMap(({ system, value }): SourceName[] =>
      system === IDENTIFIER_SYSTEM.URI && value ? [[value, name]] : [],
    );
  }
}
