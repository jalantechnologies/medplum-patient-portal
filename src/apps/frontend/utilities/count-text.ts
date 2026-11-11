import type { Nullable } from "../types";

interface CountWords {
  none: string;
  plural: string;
  singular: string;
}

export const describeCount = (
  count: Nullable<number>,
  { none, plural, singular }: CountWords,
): string => {
  if (!count) {
    return none;
  }
  return `${count} ${count === 1 ? singular : plural}`;
};
