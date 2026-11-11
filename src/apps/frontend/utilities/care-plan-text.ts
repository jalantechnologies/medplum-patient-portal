import type { Nullable } from "../types";
import { describeCount } from "./count-text";

export const describeActiveCarePlans = (
  activeCarePlanCount: Nullable<number>,
): string =>
  describeCount(activeCarePlanCount, {
    none: "No ongoing plans",
    plural: "ongoing plans",
    singular: "ongoing plan",
  });
