import {
  formatSearchQuery,
  MedplumClient,
  Operator,
  type Filter,
  type MedplumRequestOptions,
  type ResourceArray,
  type WithId,
} from "@medplum/core";
import type { Bundle, ExtractResource, ResourceType } from "@medplum/fhirtypes";

import { configuration } from "../../configuration";
import constant from "../../constants";
import {
  SEARCH_PARAMETER,
  SEARCH_TOTAL,
  SEARCH_VALUE_SEPARATOR,
} from "../../constants/fhir";
import {
  AsynchronousOperationError,
  ServiceResponse,
  type Nullable,
  type SearchPage,
  type SearchPosition,
  type SearchPreview,
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

  protected async countResources(
    resourceType: ResourceType,
    filters: Filter[],
  ): Promise<number> {
    const bundle = await this.medplumClient.search(
      resourceType,
      formatSearchQuery({
        resourceType,
        filters,
        count: 0,
        total: SEARCH_TOTAL.ACCURATE,
      }),
      MedplumService.freshRequestOptions,
    );
    return MedplumService.readTotal(bundle);
  }

  protected async searchPreview<PreviewResourceType extends ResourceType>(
    resourceType: PreviewResourceType,
    search: NewestFirstSearch,
  ): Promise<SearchPreview<WithId<ExtractResource<PreviewResourceType>>>> {
    const [datedResources, undatedResources] = await Promise.all(
      [DATED_RECORDS_START, UNDATED_RECORDS_START].map((position) =>
        this.searchAt(
          resourceType,
          search,
          position,
          constant.SEARCH_PREVIEW_SIZE,
        ),
      ),
    );
    return {
      resources: [...datedResources, ...undatedResources].slice(
        0,
        constant.SEARCH_PREVIEW_SIZE,
      ),
      total:
        MedplumService.readTotal(datedResources.bundle) +
        MedplumService.readTotal(undatedResources.bundle),
    };
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
    return new ServiceResponse(
      await this.readNextPage(resourceType, search, previousPage),
    );
  }

  protected async readNextPage<PageResourceType extends ResourceType>(
    resourceType: PageResourceType,
    search: NewestFirstSearch,
    previousPage: Nullable<
      SearchPage<WithId<ExtractResource<PageResourceType>>>
    >,
  ): Promise<SearchPage<WithId<ExtractResource<PageResourceType>>>> {
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
    return {
      nextPosition,
      resources: [
        ...previousResources,
        ...resources.filter(
          (resource) => !previousIdentifiers.has(resource.id),
        ),
      ],
    };
  }

  protected async searchByIdentifiers<
    SearchedResourceType extends ResourceType,
  >(
    resourceType: SearchedResourceType,
    identifiers: string[],
    filters: Filter[],
  ): Promise<WithId<ExtractResource<SearchedResourceType>>[]> {
    const batches = await Promise.all(
      MedplumService.splitIntoPages(identifiers).map((pageIdentifiers) =>
        this.medplumClient.searchResources(
          resourceType,
          formatSearchQuery({
            resourceType,
            filters: [
              {
                code: SEARCH_PARAMETER.ID,
                operator: Operator.EQUALS,
                value: pageIdentifiers.join(SEARCH_VALUE_SEPARATOR),
              },
              ...filters,
            ],
            count: pageIdentifiers.length,
          }),
          MedplumService.freshRequestOptions,
        ),
      ),
    );
    return batches.flat();
  }

  private static splitIntoPages(identifiers: string[]): string[][] {
    const pageCount = Math.ceil(identifiers.length / constant.SEARCH_PAGE_SIZE);
    return Array.from({ length: pageCount }, (_, pageIndex) =>
      identifiers.slice(
        pageIndex * constant.SEARCH_PAGE_SIZE,
        (pageIndex + 1) * constant.SEARCH_PAGE_SIZE,
      ),
    );
  }

  private static readTotal(bundle: Bundle): number {
    if (bundle.total === undefined) {
      throw new AsynchronousOperationError(constant.DEFAULT_ERROR_MESSAGE);
    }
    return bundle.total;
  }

  // Medplum lists the records with no date first when it sorts newest first, so those are read in a search of their own, after every dated record.
  private searchAt<SearchedResourceType extends ResourceType>(
    resourceType: SearchedResourceType,
    { dateParameter, filters }: NewestFirstSearch,
    position: SearchPosition,
    count: number,
  ): Promise<ResourceArray<WithId<ExtractResource<SearchedResourceType>>>> {
    return this.medplumClient.searchResources(
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
  }

  private async searchFrom<PageResourceType extends ResourceType>(
    resourceType: PageResourceType,
    search: NewestFirstSearch,
    position: SearchPosition,
    count: number,
  ): Promise<SearchPage<WithId<ExtractResource<PageResourceType>>>> {
    const resources = await this.searchAt(
      resourceType,
      search,
      position,
      count,
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
      search,
      UNDATED_RECORDS_START,
      count - resources.length,
    );
    return {
      nextPosition: undatedPage.nextPosition,
      resources: [...resources, ...undatedPage.resources],
    };
  }
}
