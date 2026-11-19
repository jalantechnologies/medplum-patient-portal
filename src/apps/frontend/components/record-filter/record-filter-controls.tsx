import { Block } from "baseui/block";
import { Input, SIZE as INPUT_SIZE } from "baseui/input";
import {
  Select,
  SIZE as SELECT_SIZE,
  type Option,
  type Value,
} from "baseui/select";
import type { FC } from "react";

import type { Nullable, RecordFilterChoices } from "../../types";

const ALL_SOURCES = { id: "", label: "All sources" };

const ALL_SOURCES_TEST_KEY = "all";

const SEARCHABLE_COLUMNS = ["1fr", "1fr", "minmax(0, 26.25rem) 15rem"];

const SOURCE_ONLY_COLUMNS = ["1fr", "1fr", "15rem"];

const readSourceIdentifier = ([option]: Value): Nullable<string> =>
  option?.id ? String(option.id) : null;

const labelSourceOption = ({ option }: { option: Option }) => (
  <Block
    as="span"
    data-testid={`record-source-option-${option.id || ALL_SOURCES_TEST_KEY}`}
  >
    {option.label}
  </Block>
);

const RecordFilterControls: FC<RecordFilterChoices> = ({
  changeSearchText,
  hasRecordSourcesFailed,
  isSearchable,
  isWaitingForSources,
  searchInputRef,
  searchText,
  selectSource,
  selectedSourceIdentifier,
  sourceControlRef,
  sources,
}) => {
  const sourceOptions = [
    ALL_SOURCES,
    ...sources.map(({ identifier, name }) => ({ id: identifier, label: name })),
  ];
  const selectedOption =
    sourceOptions.find(({ id }) => id === selectedSourceIdentifier) ??
    ALL_SOURCES;
  const pendingSourcesText = hasRecordSourcesFailed
    ? "Could not load sources"
    : "Loading sources";

  return (
    <Block
      role="search"
      display="grid"
      gridTemplateColumns={
        isSearchable ? SEARCHABLE_COLUMNS : SOURCE_ONLY_COLUMNS
      }
      gridGap="scale600"
      marginTop="scale800"
      marginBottom="scale800"
      data-testid="record-filter"
    >
      {isSearchable ? (
        <Input
          aria-label="Search records"
          placeholder="Search records"
          size={INPUT_SIZE.compact}
          clearable
          inputRef={searchInputRef}
          value={searchText}
          onChange={(event) => changeSearchText(event.currentTarget.value)}
          overrides={{ Input: { props: { "data-testid": "record-search" } } }}
        />
      ) : null}
      <Select
        aria-label={
          isWaitingForSources ? `${pendingSourcesText}. Source` : "Source"
        }
        options={sourceOptions}
        value={isWaitingForSources ? [] : [selectedOption]}
        placeholder={pendingSourcesText}
        isLoading={isWaitingForSources && !hasRecordSourcesFailed}
        getOptionLabel={labelSourceOption}
        size={SELECT_SIZE.compact}
        clearable={false}
        controlRef={sourceControlRef}
        onChange={({ value }) => selectSource(readSourceIdentifier(value))}
        overrides={{ Input: { props: { "data-testid": "record-source" } } }}
      />
    </Block>
  );
};

export default RecordFilterControls;
