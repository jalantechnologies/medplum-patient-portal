const routes = {
  HEALTH_PROFILE: "/health-profile",
  HEALTH_RECORDS: "/health-records",
  HOME: "/",
  MEDICATIONS: "/medications",
  SIGN_IN: "/sign-in",
  SIGN_UP: "/sign-up",
  TEST_RESULTS: "/test-results",
};

export const ROUTE_SEARCH_PARAMETER = {
  SEARCH: "search",
  SOURCE: "source",
  TAB: "tab",
} as const;

export const HEALTH_RECORDS_TAB = {
  CONDITIONS: { key: "conditions", title: "Conditions" },
  ALLERGIES: { key: "allergies", title: "Allergies" },
  PROCEDURES: { key: "procedures", title: "Procedures" },
  MEASUREMENTS: { key: "measurements", title: "Measurements" },
} as const;

export default routes;
