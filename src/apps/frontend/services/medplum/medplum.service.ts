import {
  formatSearchQuery,
  MedplumClient,
  Operator,
  type Filter,
  type IncludeTarget,
  type MedplumRequestOptions,
  type WithId,
} from "@medplum/core";
import type {
  Bundle,
  BundleEntry,
  ExtractResource,
  Resource,
  ResourceType,
} from "@medplum/fhirtypes";

import { configuration } from "../../configuration";
import constant from "../../constants";
import {
  BUNDLE_REQUEST_METHOD,
  BUNDLE_TYPE,
  RESOURCE_TYPE,
  SEARCH_ENTRY_MODE,
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
  include?: IncludeTarget[];
}

interface SearchAnswer<SearchedResource> {
  bundle: Bundle;
  includedResources: WithId<Resource>[];
  resources: SearchedResource[];
}

interface PageWithIncludedResources<PageResource> {
  includedResources: WithId<Resource>[];
  page: SearchPage<PageResource>;
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
    search: Omit<NewestFirstSearch, "include">,
  ): Promise<SearchPreview<WithId<ExtractResource<PreviewResourceType>>>> {
    const [datedRecords, undatedRecords] = await Promise.all(
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
      resources: [...datedRecords.resources, ...undatedRecords.resources].slice(
        0,
        constant.SEARCH_PREVIEW_SIZE,
      ),
      total:
        MedplumService.readTotal(datedRecords.bundle) +
        MedplumService.readTotal(undatedRecords.bundle),
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
    const { page } = await this.readNextPage(
      resourceType,
      search,
      previousPage,
    );
    return new ServiceResponse(page);
  }

  protected async readNextPage<PageResourceType extends ResourceType>(
    resourceType: PageResourceType,
    search: NewestFirstSearch,
    previousPage: Nullable<
      SearchPage<WithId<ExtractResource<PageResourceType>>>
    >,
  ): Promise<
    PageWithIncludedResources<WithId<ExtractResource<PageResourceType>>>
  > {
    const previousResources = previousPage?.resources ?? [];
    const position = previousPage
      ? previousPage.nextPosition
      : DATED_RECORDS_START;
    const { includedResources, page } = position
      ? await this.searchFrom(
          resourceType,
          search,
          position,
          constant.SEARCH_PAGE_SIZE,
        )
      : { includedResources: [], page: { nextPosition: null, resources: [] } };
    // A record added between two pages moves every later record down by one, so this page can repeat the last record of the one before.
    const previousIdentifiers = new Set(
      previousResources.map((resource) => resource.id),
    );
    return {
      includedResources,
      page: {
        nextPosition: page.nextPosition,
        resources: [
          ...previousResources,
          ...page.resources.filter(
            (resource) => !previousIdentifiers.has(resource.id),
          ),
        ],
      },
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

  // A version that Medplum cannot return, because it does not exist or the patient may not read it, is left out, as Medplum's _include leaves out a reference it cannot read.
  protected async readVersions<VersionResourceType extends ResourceType>(
    resourceType: VersionResourceType,
    references: string[],
  ): Promise<ReadonlyMap<string, ExtractResource<VersionResourceType>>> {
    if (references.length === 0) {
      return new Map();
    }
    const { entry = [] } = await this.medplumClient.executeBatch({
      resourceType: RESOURCE_TYPE.BUNDLE,
      type: BUNDLE_TYPE.BATCH,
      entry: references.map((url) => ({
        request: { method: BUNDLE_REQUEST_METHOD.GET, url },
      })),
    });
    return new Map(
      references.flatMap((reference, index) => {
        const resource = entry[index]?.resource;
        return resource && MedplumService.isOfType(resource, resourceType)
          ? [[reference, resource] as const]
          : [];
      }),
    );
  }

  protected static isOfType<
    ExpectedResourceType extends ResourceType,
    CheckedResource extends Resource,
  >(
    resource: CheckedResource,
    resourceType: ExpectedResourceType,
  ): resource is CheckedResource & ExtractResource<ExpectedResourceType> {
    return resource.resourceType === resourceType;
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

  private static listEntryResources<EntryResource extends Resource>(
    entries: BundleEntry<EntryResource>[],
  ): EntryResource[] {
    return entries.flatMap(({ resource }) => (resource ? [resource] : []));
  }

  private static isIncludedEntry({ search }: BundleEntry): boolean {
    return search?.mode === SEARCH_ENTRY_MODE.INCLUDE;
  }

  private static isMatchEntry({ search }: BundleEntry): boolean {
    return !search?.mode || search.mode === SEARCH_ENTRY_MODE.MATCH;
  }

  private static readTotal(bundle: Bundle): number {
    if (bundle.total === undefined) {
      throw new AsynchronousOperationError(constant.DEFAULT_ERROR_MESSAGE);
    }
    return bundle.total;
  }

  // Medplum lists the records with no date first when it sorts newest first, so those are read in a search of their own, after every dated record.
  private async searchAt<SearchedResourceType extends ResourceType>(
    resourceType: SearchedResourceType,
    { dateParameter, filters, include }: NewestFirstSearch,
    position: SearchPosition,
    count: number,
  ): Promise<SearchAnswer<WithId<ExtractResource<SearchedResourceType>>>> {
    const bundle = await this.medplumClient.search(
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
        include,
        count,
        offset: position.offset,
        total: SEARCH_TOTAL.ACCURATE,
      }),
      MedplumService.freshRequestOptions,
    );
    const entries = bundle.entry ?? [];
    return {
      bundle,
      includedResources: MedplumService.listEntryResources(
        entries.filter(MedplumService.isIncludedEntry),
      ),
      resources: MedplumService.listEntryResources(
        entries.filter(MedplumService.isMatchEntry),
      ),
    };
  }

  private async searchFrom<PageResourceType extends ResourceType>(
    resourceType: PageResourceType,
    search: NewestFirstSearch,
    position: SearchPosition,
    count: number,
  ): Promise<
    PageWithIncludedResources<WithId<ExtractResource<PageResourceType>>>
  > {
    const { bundle, includedResources, resources } = await this.searchAt(
      resourceType,
      search,
      position,
      count,
    );
    const offset = position.offset + resources.length;
    if (offset < (bundle.total ?? 0)) {
      return {
        includedResources,
        page: { nextPosition: { ...position, offset }, resources },
      };
    }
    if (!position.hasDate) {
      return { includedResources, page: { nextPosition: null, resources } };
    }
    const undated = await this.searchFrom(
      resourceType,
      search,
      UNDATED_RECORDS_START,
      count - resources.length,
    );
    return {
      includedResources: [...includedResources, ...undated.includedResources],
      page: {
        nextPosition: undated.page.nextPosition,
        resources: [...resources, ...undated.page.resources],
      },
    };
  }
}
