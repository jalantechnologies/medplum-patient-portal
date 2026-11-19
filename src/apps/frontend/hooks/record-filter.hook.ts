import type { ImperativeMethods } from "baseui/select";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";

import constant from "../constants";
import { ROUTE_SEARCH_PARAMETER } from "../constants/routes";
import type {
  Nullable,
  RecordFilter,
  RecordFilterChoices,
  RecordListFilter,
  RecordSource,
} from "../types";

interface RecordFilterSource {
  hasRecordSourcesFailed: boolean;
  isSearchable: boolean;
  recordSources: Nullable<readonly RecordSource[]>;
}

interface AddressChange {
  searchText?: string;
  sourceIdentifier?: Nullable<string>;
}

const NO_SEARCH_TEXT = "";

const setOrDelete = (
  search: URLSearchParams,
  name: string,
  value: Nullable<string>,
) => {
  if (value) {
    search.set(name, value);
  } else {
    search.delete(name);
  }
};

const useRecordFilterAddress = (isSearchable: boolean) => {
  const { hash, state } = useLocation();
  const navigate = useNavigate();
  const [searchParameters] = useSearchParams();

  const changeAddress = useCallback(
    ({ searchText, sourceIdentifier }: AddressChange) => {
      const search = new URLSearchParams(searchParameters);
      if (searchText !== undefined) {
        setOrDelete(search, ROUTE_SEARCH_PARAMETER.SEARCH, searchText);
      }
      if (sourceIdentifier !== undefined) {
        setOrDelete(search, ROUTE_SEARCH_PARAMETER.SOURCE, sourceIdentifier);
      }
      void navigate(
        { hash, search: search.toString() },
        { replace: true, state },
      );
    },
    [hash, navigate, searchParameters, state],
  );

  return {
    addressSearchText: isSearchable
      ? (searchParameters.get(ROUTE_SEARCH_PARAMETER.SEARCH) ?? NO_SEARCH_TEXT)
      : NO_SEARCH_TEXT,
    addressSourceIdentifier: searchParameters.get(
      ROUTE_SEARCH_PARAMETER.SOURCE,
    ),
    changeAddress,
  };
};

const useSearchText = (
  addressSearchText: string,
  changeAddress: (change: AddressChange) => void,
) => {
  const [searchText, setSearchText] = useState(addressSearchText);
  const [shownAddressSearchText, setShownAddressSearchText] =
    useState(addressSearchText);
  const [writtenSearchText, setWrittenSearchText] = useState(addressSearchText);

  // The patient may type on while the address takes the text written before, so only an address changed by something else, such as a link to this page or the back button, replaces what is in the box.
  if (addressSearchText !== shownAddressSearchText) {
    setShownAddressSearchText(addressSearchText);
    if (addressSearchText !== writtenSearchText) {
      setSearchText(addressSearchText);
      setWrittenSearchText(addressSearchText);
    }
  }

  useEffect(() => {
    if (searchText === addressSearchText) {
      return;
    }
    const timeout = setTimeout(() => {
      setWrittenSearchText(searchText);
      changeAddress({ searchText });
    }, constant.SEARCH_INPUT_DELAY_MILLISECONDS);
    return () => clearTimeout(timeout);
  }, [addressSearchText, changeAddress, searchText]);

  return { searchText, setSearchText };
};

const useSourceChoice = (
  recordSources: Nullable<readonly RecordSource[]>,
  addressSourceIdentifier: Nullable<string>,
) => {
  const sources = useMemo(
    () =>
      (recordSources ?? []).filter(
        ({ addresses, name }) => Boolean(name) && addresses.length > 0,
      ),
    [recordSources],
  );
  return {
    isWaitingForSources:
      addressSourceIdentifier !== null && recordSources === null,
    selectedSource: sources.find(
      ({ identifier }) => identifier === addressSourceIdentifier,
    ),
    sources,
  };
};

interface CurrentRecordFilterSource {
  addressSearchText: string;
  isWaitingForSources: boolean;
  selectedSource: RecordSource | undefined;
}

const useCurrentRecordFilter = ({
  addressSearchText,
  isWaitingForSources,
  selectedSource,
}: CurrentRecordFilterSource) => {
  const sourceAddresses = selectedSource?.addresses;
  const text = addressSearchText.trim();
  const recordFilter = useMemo<Nullable<RecordFilter>>(
    () =>
      isWaitingForSources
        ? null
        : { sourceAddresses: sourceAddresses ?? [], text },
    [isWaitingForSources, sourceAddresses, text],
  );
  return {
    isFiltered:
      isWaitingForSources ||
      sourceAddresses !== undefined ||
      text !== NO_SEARCH_TEXT,
    recordFilter,
  };
};

const useRecordFilterFocus = (isSearchable: boolean) => {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const sourceControlRef = useRef<ImperativeMethods>(null);
  const focusRecordFilter = () => {
    if (isSearchable) {
      searchInputRef.current?.focus();
    } else {
      sourceControlRef.current?.focus();
    }
  };
  return { focusRecordFilter, searchInputRef, sourceControlRef };
};

const useRecordFilter = ({
  hasRecordSourcesFailed,
  isSearchable,
  recordSources,
}: RecordFilterSource) => {
  const { addressSearchText, addressSourceIdentifier, changeAddress } =
    useRecordFilterAddress(isSearchable);
  const { searchText, setSearchText } = useSearchText(
    addressSearchText,
    changeAddress,
  );
  const { isWaitingForSources, selectedSource, sources } = useSourceChoice(
    recordSources,
    addressSourceIdentifier,
  );
  const { isFiltered, recordFilter } = useCurrentRecordFilter({
    addressSearchText,
    isWaitingForSources,
    selectedSource,
  });
  const { focusRecordFilter, searchInputRef, sourceControlRef } =
    useRecordFilterFocus(isSearchable);

  const recordFilterChoices: RecordFilterChoices = {
    changeSearchText: setSearchText,
    hasRecordSourcesFailed,
    isSearchable,
    isWaitingForSources,
    searchInputRef,
    searchText,
    selectSource: (sourceIdentifier) => changeAddress({ sourceIdentifier }),
    selectedSourceIdentifier: selectedSource?.identifier ?? null,
    sourceControlRef,
    sources,
  };
  const recordListFilter: RecordListFilter = {
    clearRecordFilter: () => {
      setSearchText(NO_SEARCH_TEXT);
      changeAddress({ searchText: NO_SEARCH_TEXT, sourceIdentifier: null });
      focusRecordFilter();
    },
    hasRecordFilterFailed: isWaitingForSources && hasRecordSourcesFailed,
    isFiltered,
    recordFilter,
  };

  return { recordFilterChoices, recordListFilter };
};

export default useRecordFilter;
