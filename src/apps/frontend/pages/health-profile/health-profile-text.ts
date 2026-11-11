import type { ActiveAllergyIntolerancePreview, Nullable } from "../../types";
import { describeCount, nameAllergyIntolerance } from "../../utilities";

const NAME_SEPARATOR = ", ";

export const describeActivePrescriptions = (
  activePrescriptionCount: Nullable<number>,
): string =>
  describeCount(activePrescriptionCount, {
    none: "No active prescriptions",
    plural: "active prescriptions",
    singular: "active prescription",
  });

export const describeActiveAllergies = (
  activeAllergyPreview: Nullable<ActiveAllergyIntolerancePreview>,
): string => {
  if (!activeAllergyPreview?.resources.length) {
    return activeAllergyPreview?.hasRecordedAllergyIntolerances
      ? "No active allergies recorded"
      : "Not yet recorded";
  }
  const names = activeAllergyPreview.resources
    .map(nameAllergyIntolerance)
    .join(NAME_SEPARATOR);
  const remainingCount =
    activeAllergyPreview.total - activeAllergyPreview.resources.length;
  return remainingCount > 0 ? `${names} and ${remainingCount} more` : names;
};
