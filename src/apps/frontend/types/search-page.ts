import type { Nullable } from "./common";

export interface SearchPosition {
  hasDate: boolean;
  offset: number;
}

export interface SearchPage<Resource> {
  nextPosition: Nullable<SearchPosition>;
  resources: Resource[];
}
