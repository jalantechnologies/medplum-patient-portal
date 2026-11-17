export const DATE_FORMAT = {
  DAY: { day: "numeric", month: "long", year: "numeric" },
  MONTH: { month: "long", year: "numeric" },
  YEAR: { year: "numeric" },
  TIME: { hour: "numeric", minute: "2-digit", timeZoneName: "longGeneric" },
} as const satisfies Record<string, Intl.DateTimeFormatOptions>;
