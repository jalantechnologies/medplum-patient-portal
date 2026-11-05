import type { WithId } from "@medplum/core";
import type { AllergyIntolerance } from "@medplum/fhirtypes";
import { createContext, useContext } from "react";

import type {
  AsynchronousOperationError,
  Nullable,
  SearchPage,
} from "../types";

type AllergyIntoleranceContextType = {
  allergyIntolerancePage: Nullable<SearchPage<WithId<AllergyIntolerance>>>;
  allergyIntolerancePageError: Nullable<AsynchronousOperationError>;
  isAllergyIntolerancePageLoading: boolean;
  isAllergyIntolerancePageRequesting: boolean;
  listAllergyIntolerances: (
    patientReference: string,
    previousPage?: Nullable<SearchPage<WithId<AllergyIntolerance>>>,
  ) => Promise<Nullable<SearchPage<WithId<AllergyIntolerance>>>>;
};

export const AllergyIntoleranceContext =
  createContext<Nullable<AllergyIntoleranceContextType>>(null);

export const useAllergyIntoleranceContext =
  (): AllergyIntoleranceContextType => {
    const allergyIntoleranceContext = useContext(AllergyIntoleranceContext);
    if (!allergyIntoleranceContext) {
      throw new Error(
        "useAllergyIntoleranceContext must be used inside AllergyIntoleranceProvider",
      );
    }
    return allergyIntoleranceContext;
  };
