import {
  formatSearchQuery,
  MedplumClient,
  type MedplumRequestOptions,
  type SearchRequest,
  type WithId,
} from "@medplum/core";
import type { ExtractResource, ResourceType } from "@medplum/fhirtypes";

import { configuration } from "../../configuration";
import constant from "../../constants";
import { SEARCH_TOTAL } from "../../constants/fhir";
import { ServiceResponse, type Nullable, type SearchPage } from "../../types";

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
    { filters, sortRules }: Pick<SearchRequest, "filters" | "sortRules">,
    previousPage: Nullable<
      SearchPage<WithId<ExtractResource<PageResourceType>>>
    >,
  ): Promise<
    ServiceResponse<SearchPage<WithId<ExtractResource<PageResourceType>>>>
  > {
    const previousResources = previousPage?.resources ?? [];
    const offset = previousResources.length;
    const resources = await this.medplumClient.searchResources(
      resourceType,
      formatSearchQuery({
        resourceType,
        filters,
        sortRules,
        count: constant.SEARCH_PAGE_SIZE,
        offset,
        total: SEARCH_TOTAL.ACCURATE,
      }),
      MedplumService.freshRequestOptions,
    );
    // A record added between two pages moves every later record down by one, so this page can repeat the last record of the one before.
    const previousIdentifiers = new Set(
      previousResources.map((resource) => resource.id),
    );
    return new ServiceResponse({
      hasNextPage: offset + resources.length < (resources.bundle.total ?? 0),
      resources: [
        ...previousResources,
        ...resources.filter(
          (resource) => !previousIdentifiers.has(resource.id),
        ),
      ],
    });
  }
}
