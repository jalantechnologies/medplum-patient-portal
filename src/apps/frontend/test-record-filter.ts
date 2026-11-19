import {
  Operator,
  type Filter,
  type QueryTypes,
  type SearchRequest,
} from "@medplum/core";
import type { ResourceType } from "@medplum/fhirtypes";
import type { MockClient } from "@medplum/mock";
import { fireEvent, screen } from "@testing-library/react";
import type userEvent from "@testing-library/user-event";
import type { MockInstance } from "vitest";

import { SEARCH_PARAMETER } from "./constants/fhir";
import {
  addListedOrganizations,
  interceptSearches,
  readSearchRequest,
  searchCodeTextAsServer,
} from "./test-medplum";

type User = ReturnType<typeof userEvent.setup>;

type SearchSpy = MockInstance<MockClient["search"]>;

const SOURCE_OPTION_TEST_IDENTIFIER = /^record-source-option-/;

const KEY_CODE = { ARROW_DOWN: 40, ENTER: 13 };

export const ALL_SOURCES = "All sources";

export const isSourceFilter = ({ code }: Filter) =>
  code === SEARCH_PARAMETER.SOURCE;

export const isTextFilter = ({ code, operator }: Filter) =>
  code === SEARCH_PARAMETER.CODE && operator === Operator.TEXT;

export const answerAsServer = (
  medplum: MockClient,
  waitBefore: (
    resourceType: string,
    searchRequest: SearchRequest,
  ) => Promise<void> = async () => {},
) =>
  interceptSearches(medplum, async (_, resourceType, query, options) => {
    await waitBefore(
      resourceType,
      readSearchRequest(medplum, resourceType as ResourceType, query),
    );
    return addListedOrganizations(
      medplum,
      await searchCodeTextAsServer(medplum, resourceType, query, options),
      resourceType,
    );
  });

export const getSourceMenu = () => screen.getByTestId("record-source");

export const getSearchBox = () => screen.getByTestId("record-search");

const findSourceOption = async (sourceName: string) => {
  const sourceOption = (
    await screen.findAllByTestId(SOURCE_OPTION_TEST_IDENTIFIER)
  ).find(({ textContent }) => textContent === sourceName);
  if (!sourceOption) {
    throw new Error(`The source menu has no option named ${sourceName}`);
  }
  return sourceOption;
};

export const chooseRecordSource = async (user: User, sourceName: string) => {
  await user.click(getSourceMenu());
  await user.click(await findSourceOption(sourceName));
};

// Base Web's Select reads the deprecated keyCode, which user-event leaves at 0; browsers set it.
export const chooseNextRecordSourceByKeyboard = (steps: number) => {
  const sourceMenu = getSourceMenu();
  sourceMenu.focus();
  for (let step = 0; step < steps; step += 1) {
    fireEvent.keyDown(sourceMenu, {
      key: "ArrowDown",
      keyCode: KEY_CODE.ARROW_DOWN,
    });
  }
  fireEvent.keyDown(sourceMenu, { key: "Enter", keyCode: KEY_CODE.ENTER });
};

export const listSourceOptionNames = () =>
  screen
    .getAllByTestId(SOURCE_OPTION_TEST_IDENTIFIER)
    .map(({ textContent }) => textContent);

export const searchRecords = async (user: User, text: string) => {
  const searchBox = getSearchBox();
  await user.clear(searchBox);
  await user.type(searchBox, text);
};

export const listFilterValues = (
  medplum: MockClient,
  search: SearchSpy,
  resourceType: string,
  isWanted: (filter: Filter) => boolean,
): (string | undefined)[] =>
  search.mock.calls
    .filter(([searchedResourceType]) => searchedResourceType === resourceType)
    .map(
      ([searchedResourceType, query]) =>
        readSearchRequest(
          medplum,
          searchedResourceType,
          query as QueryTypes,
        ).filters?.find(isWanted)?.value,
    );
