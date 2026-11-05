export const DATE_FORMAT = {
  DAY: { day: "numeric", month: "long", year: "numeric" },
  MONTH: { month: "long", year: "numeric" },
  YEAR: { year: "numeric" },
} as const satisfies Record<string, Intl.DateTimeFormatOptions>;
