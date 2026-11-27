import {
  escapeSearchValue,
  formatSearchQuery,
  MedplumClient,
  OperationOutcomeError,
  Operator,
  type Filter,
  type IncludeTarget,
  type MedplumRequestOptions,
  type SearchRequest,
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
  type RecordFilter,
  type SearchPage,
  type SearchPosition,
  type SearchPreview,
} from "../../types";

interface NewestFirstSearch {
  dateParameter: string;
  filters: Filter[];
  include?: IncludeTarget[];
}

interface LastUpdatedSearch {
  filters: Filter[];
  resourceType: ResourceType;
}

interface SearchAnswer<SearchedResource> {
  bundle: Bundle;
  includedResources: WithId<Resource>[];
  resources: SearchedResource[];
}

interface NewestFirstAnswer<SearchedResource> {
  bundles: Bundle[];
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
    const { bundles, resources } = await this.searchNewestFirst(
      resourceType,
      search,
      constant.SEARCH_PREVIEW_SIZE,
      SEARCH_TOTAL.ACCURATE,
    );
    return {
      resources,
      total: bundles.reduce(
        (total, bundle) => total + MedplumService.readTotal(bundle),
        0,
      ),
    };
  }

  protected async listNewest<NewestResourceType extends ResourceType>(
    resourceType: NewestResourceType,
    search: Omit<NewestFirstSearch, "include">,
    count: number,
  ): Promise<WithId<ExtractResource<NewestResourceType>>[]> {
    const { resources } = await this.searchNewestFirst(
      resourceType,
      search,
      count,
      SEARCH_TOTAL.NONE,
    );
    return resources;
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

  protected async readAllPages<PageResourceType extends ResourceType>(
    resourceType: PageResourceType,
    search: NewestFirstSearch,
    previousPage: Nullable<
      SearchPage<WithId<ExtractResource<PageResourceType>>>
    > = null,
  ): Promise<
    PageWithIncludedResources<WithId<ExtractResource<PageResourceType>>>
  > {
    const { includedResources, page } = await this.readNextPage(
      resourceType,
      search,
      previousPage,
    );
    if (!page.nextPosition) {
      return { includedResources, page };
    }
    const laterPages = await this.readAllPages(resourceType, search, page);
    return {
      includedResources: [
        ...includedResources,
        ...laterPages.includedResources,
      ],
      page: laterPages.page,
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

  protected async findLastUpdated(
    searches: LastUpdatedSearch[],
  ): Promise<string | undefined> {
    const { entry = [] } = await this.medplumClient.executeBatch({
      resourceType: RESOURCE_TYPE.BUNDLE,
      type: BUNDLE_TYPE.BATCH,
      entry: searches.map(({ filters, resourceType }) => ({
        request: {
          method: BUNDLE_REQUEST_METHOD.GET,
          url: `${resourceType}${formatSearchQuery({
            resourceType,
            filters,
            sortRules: [
              { code: SEARCH_PARAMETER.LAST_UPDATED, descending: true },
            ],
            count: 1,
          })}`,
        },
      })),
    });
    return searches
      .map((_, index) => MedplumService.readLastUpdated(entry[index]))
      .reduce<string | undefined>(
        (newest, lastUpdated) =>
          lastUpdated &&
          (!newest || Date.parse(lastUpdated) > Date.parse(newest))
            ? lastUpdated
            : newest,
        undefined,
      );
  }

  protected static toRecordFilters(
    recordFilter: RecordFilter,
    textSearchParameter:
      | typeof SEARCH_PARAMETER.CODE
      | typeof SEARCH_PARAMETER.VACCINE_CODE = SEARCH_PARAMETER.CODE,
  ): Filter[] {
    const { text } = recordFilter;
    const textFilters: Filter[] = text
      ? [
          {
            code: textSearchParameter,
            operator: Operator.TEXT,
            value: escapeSearchValue(text),
          },
        ]
      : [];
    return [...MedplumService.toSourceFilters(recordFilter), ...textFilters];
  }

  protected static toSourceFilters({
    sourceAddresses,
  }: RecordFilter): Filter[] {
    return sourceAddresses.length > 0
      ? [
          {
            code: SEARCH_PARAMETER.SOURCE,
            operator: Operator.EQUALS,
            value: sourceAddresses
              .map(escapeSearchValue)
              .join(SEARCH_VALUE_SEPARATOR),
          },
        ]
      : [];
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

  private static readLastUpdated(
    entry: BundleEntry | undefined,
  ): string | undefined {
    const resource = entry?.resource;
    if (!resource || !MedplumService.isOfType(resource, RESOURCE_TYPE.BUNDLE)) {
      const outcome = entry?.response?.outcome;
      throw outcome
        ? new OperationOutcomeError(outcome)
        : new AsynchronousOperationError(constant.DEFAULT_ERROR_MESSAGE);
    }
    return resource.entry?.[0]?.resource?.meta?.lastUpdated;
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
    total: SearchRequest["total"],
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
        total,
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

  private async searchNewestFirst<SearchedResourceType extends ResourceType>(
    resourceType: SearchedResourceType,
    search: Omit<NewestFirstSearch, "include">,
    count: number,
    total: SearchRequest["total"],
  ): Promise<NewestFirstAnswer<WithId<ExtractResource<SearchedResourceType>>>> {
    const answers = await Promise.all(
      [DATED_RECORDS_START, UNDATED_RECORDS_START].map((position) =>
        this.searchAt(resourceType, search, position, count, total),
      ),
    );
    return {
      bundles: answers.map(({ bundle }) => bundle),
      resources: answers.flatMap(({ resources }) => resources).slice(0, count),
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
      SEARCH_TOTAL.ACCURATE,
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
