import { createContext, useContext } from "react";

import type {
  ActiveAllergyIntolerancePreview,
  AllergyIntoleranceSearch,
  AsynchronousOperationError,
  Nullable,
} from "../types";

type AllergyIntoleranceContextType = {
  activeAllergyIntolerancePreview: Nullable<ActiveAllergyIntolerancePreview>;
  activeAllergyIntolerancePreviewError: Nullable<AsynchronousOperationError>;
  allergyIntolerances: AllergyIntoleranceSearch;
  isActiveAllergyIntolerancePreviewLoading: boolean;
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
