import { getCodeBySystem } from "@medplum/core";
import type { AllergyIntolerance } from "@medplum/fhirtypes";

import {
  ALLERGY_INTOLERANCE_VERIFICATION_STATUS,
  CODE_SYSTEM,
} from "../../constants/fhir";
import type { ActiveAllergyIntolerancePreview, Nullable } from "../../types";
import {
  describeCount,
  joinDetails,
  nameAllergyIntolerance,
} from "../../utilities";

const NAME_SEPARATOR = ", ";
const UNCONFIRMED_VERIFICATION = "Verification unconfirmed";

export const describeActivePrescriptions = (
  activePrescriptionCount: Nullable<number>,
): string =>
  describeCount(activePrescriptionCount, {
    none: "No active prescriptions",
    plural: "active prescriptions",
    singular: "active prescription",
  });

const isUnconfirmed = ({ verificationStatus }: AllergyIntolerance): boolean =>
  verificationStatus !== undefined &&
  getCodeBySystem(
    verificationStatus,
    CODE_SYSTEM.ALLERGY_INTOLERANCE_VERIFICATION,
  ) === ALLERGY_INTOLERANCE_VERIFICATION_STATUS.UNCONFIRMED;

const nameAllergyWithVerification = (
  allergyIntolerance: AllergyIntolerance,
): string =>
  joinDetails(
    nameAllergyIntolerance(allergyIntolerance),
    isUnconfirmed(allergyIntolerance) ? UNCONFIRMED_VERIFICATION : "",
  );

export const describeActiveAllergies = (
  activeAllergyPreview: Nullable<ActiveAllergyIntolerancePreview>,
): string => {
  if (!activeAllergyPreview?.resources.length) {
    return activeAllergyPreview?.hasRecordedAllergyIntolerances
      ? "No active allergies recorded"
      : "Not yet recorded";
  }
  const names = activeAllergyPreview.resources
    .map(nameAllergyWithVerification)
    .join(NAME_SEPARATOR);
  const remainingCount =
    activeAllergyPreview.total - activeAllergyPreview.resources.length;
  return remainingCount > 0 ? `${names} and ${remainingCount} more` : names;
};
