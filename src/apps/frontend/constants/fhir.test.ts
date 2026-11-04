import { getSearchParameters } from "@medplum/core";
import { describe, expect, it } from "vitest";

import { RESOURCE_TYPE, SEARCH_PARAMETER } from "./fhir";

describe("SEARCH_PARAMETER", () => {
  it("names only search parameters that FHIR defines for the portal's resource types", () => {
    const definedSearchParameterNames = new Set(
      Object.values(RESOURCE_TYPE).flatMap((resourceType) =>
        Object.keys(getSearchParameters(resourceType) ?? {}),
      ),
    );

    for (const searchParameterName of Object.values(SEARCH_PARAMETER)) {
      expect(definedSearchParameterNames).toContain(searchParameterName);
    }
  });
});
