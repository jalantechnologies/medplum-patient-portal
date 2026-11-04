import "@testing-library/jest-dom/vitest";

import { indexSearchParameterBundle } from "@medplum/core";
import { readJson, SEARCH_PARAMETER_BUNDLE_FILES } from "@medplum/definitions";
import type { Bundle, SearchParameter } from "@medplum/fhirtypes";
import { afterEach } from "vitest";

for (const filename of SEARCH_PARAMETER_BUNDLE_FILES) {
  indexSearchParameterBundle(readJson(filename) as Bundle<SearchParameter>);
}

// jsdom has no matchMedia; this stand-in matches no media query, as on a small screen.
window.matchMedia = (query: string) =>
  Object.assign(new EventTarget(), {
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
  });

afterEach(() => {
  globalThis.localStorage.clear();
});
