import {
  formatSearchQuery,
  MedplumClient,
  Operator,
  type Filter,
  type MedplumRequestOptions,
  type WithId,
} from "@medplum/core";
import type { ExtractResource, ResourceType } from "@medplum/fhirtypes";

import { configuration } from "../../configuration";
import constant from "../../constants";
import { SEARCH_PARAMETER, SEARCH_TOTAL } from "../../constants/fhir";
import {
  ServiceResponse,
  type Nullable,
  type SearchPage,
  type SearchPosition,
} from "../../types";

interface NewestFirstSearch {
  dateParameter: string;
  filters: Filter[];
}

const DATED_RECORDS_START: SearchPosition = { hasDate: true, offset: 0 };
const UNDATED_RECORDS_START: SearchPosition = { hasDate: false, offset: 0 };

export default class MedplumService {
  // A provider keeps its last answer on screen while it asks again, so Medplum's request cache would only serve an outdated answer, or replay a failed request, for up to a minute.
  static readonly freshRequestOptions: MedplumRequestOptions = {
    cache: "reload",
  };

  medplumClient: MedplumClient;

  constructor(medplumClient: MedplumClient) {
    this.medplumClient = medplumClient;
  }

  static createMedplumClient(): MedplumClient {
    return new MedplumClient({
      baseUrl: configuration.medplumServerAddress,
    });
  }

  protected async searchPage<PageResourceType extends ResourceType>(
    resourceType: PageResourceType,
    search: NewestFirstSearch,
    previousPage: Nullable<
      SearchPage<WithId<ExtractResource<PageResourceType>>>
    >,
  ): Promise<
    ServiceResponse<SearchPage<WithId<ExtractResource<PageResourceType>>>>
  > {
    const previousResources = previousPage?.resources ?? [];
    const position = previousPage
      ? previousPage.nextPosition
      : DATED_RECORDS_START;
    const { nextPosition, resources } = position
      ? await this.searchFrom(
          resourceType,
          search,
          position,
          constant.SEARCH_PAGE_SIZE,
        )
      : { nextPosition: null, resources: [] };
    // A record added between two pages moves every later record down by one, so this page can repeat the last record of the one before.
    const previousIdentifiers = new Set(
      previousResources.map((resource) => resource.id),
    );
    return new ServiceResponse({
      nextPosition,
      resources: [
        ...previousResources,
        ...resources.filter(
          (resource) => !previousIdentifiers.has(resource.id),
        ),
      ],
    });
  }

  // Medplum lists the records with no date first when it sorts newest first, so those are read in a search of their own, after every dated record.
  private async searchFrom<PageResourceType extends ResourceType>(
    resourceType: PageResourceType,
    { dateParameter, filters }: NewestFirstSearch,
    position: SearchPosition,
    count: number,
  ): Promise<SearchPage<WithId<ExtractResource<PageResourceType>>>> {
    const resources = await this.medplumClient.searchResources(
      resourceType,
      formatSearchQuery({
        resourceType,
        filters: [
          ...filters,
          {
            code: dateParameter,
            operator: Operator.MISSING,
            value: String(!position.hasDate),
          },
        ],
        sortRules: position.hasDate
          ? [{ code: dateParameter, descending: true }]
          : [{ code: SEARCH_PARAMETER.ID }],
        count,
        offset: position.offset,
        total: SEARCH_TOTAL.ACCURATE,
      }),
      MedplumService.freshRequestOptions,
    );
    const offset = position.offset + resources.length;
    if (offset < (resources.bundle.total ?? 0)) {
      return { nextPosition: { ...position, offset }, resources };
    }
    if (!position.hasDate) {
      return { nextPosition: null, resources };
    }
    const undatedPage = await this.searchFrom(
      resourceType,
      { dateParameter, filters },
      UNDATED_RECORDS_START,
      count - resources.length,
    );
    return {
      nextPosition: undatedPage.nextPosition,
      resources: [...resources, ...undatedPage.resources],
    };
  }
}
