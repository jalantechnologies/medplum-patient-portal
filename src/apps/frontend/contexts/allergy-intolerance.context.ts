import type { WithId } from "@medplum/core";
import type { AllergyIntolerance } from "@medplum/fhirtypes";
import { createContext, useContext } from "react";

import type {
  ActiveAllergyIntolerancePreview,
  AsynchronousOperationError,
  Nullable,
  SearchPage,
} from "../types";

type AllergyIntoleranceContextType = {
  activeAllergyIntolerancePreview: Nullable<ActiveAllergyIntolerancePreview>;
  activeAllergyIntolerancePreviewError: Nullable<AsynchronousOperationError>;
  allergyIntolerancePage: Nullable<SearchPage<WithId<AllergyIntolerance>>>;
  allergyIntolerancePageError: Nullable<AsynchronousOperationError>;
  isActiveAllergyIntolerancePreviewLoading: boolean;
  isAllergyIntolerancePageLoading: boolean;
  isAllergyIntolerancePageRequesting: boolean;
  listAllergyIntolerances: (
    patientReference: string,
    previousPage?: Nullable<SearchPage<WithId<AllergyIntolerance>>>,
  ) => Promise<Nullable<SearchPage<WithId<AllergyIntolerance>>>>;
  previewActiveAllergyIntolerances: (
    patientReference: string,
  ) => Promise<Nullable<ActiveAllergyIntolerancePreview>>;
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
