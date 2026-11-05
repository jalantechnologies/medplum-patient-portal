export interface SearchPage<Resource> {
  hasNextPage: boolean;
  resources: Resource[];
}
